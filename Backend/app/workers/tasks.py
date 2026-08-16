"""
Celery entry point for the IntelliSpec document-processing pipeline.

The task owns the global failure boundary. OCR/parsing runs first, then the
LangGraph agents run with stage-by-stage progress persisted to PostgreSQL and
broadcast over WebSocket.
"""
import asyncio
from datetime import datetime, timezone

from loguru import logger

from app.core.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.graphs.pipeline_graph import pipeline_graph
from app.models.ai_result import AIResult
from app.models.document import Document
from app.models.processing_job import JobStatus, PipelineStage, ProcessingJob
from app.models.product import Product, ProductStatus
from app.models.upload import Upload, UploadStatus
from app.services.ocr_service import OCRService
from app.websocket.manager import ws_manager


STAGE_WEIGHTS = {
    PipelineStage.OCR: 10,
    PipelineStage.DOCUMENT_PARSING: 20,
    PipelineStage.INFORMATION_EXTRACTION: 35,
    PipelineStage.KNOWLEDGE_GRAPH: 50,
    PipelineStage.VALIDATION: 60,
    PipelineStage.RAG_SEARCH: 70,
    PipelineStage.LLM_GENERATION: 80,
    PipelineStage.CONFIDENCE_SCORING: 90,
    PipelineStage.HUMAN_REVIEW: 95,
    PipelineStage.COMPLETED: 100,
}

NODE_STAGES = {
    "extraction": PipelineStage.INFORMATION_EXTRACTION,
    "validation": PipelineStage.VALIDATION,
    "reasoning": PipelineStage.RAG_SEARCH,
    "knowledge_graph": PipelineStage.KNOWLEDGE_GRAPH,
    "seo": PipelineStage.LLM_GENERATION,
    "recommendation": PipelineStage.LLM_GENERATION,
    "compliance": PipelineStage.LLM_GENERATION,
    "qa": PipelineStage.CONFIDENCE_SCORING,
}


async def _update_job_stage(
    job_id: str,
    stage: PipelineStage,
    status: JobStatus,
    message: str = "",
) -> None:
    """Persist and broadcast a stage update, including the real error."""
    async with AsyncSessionLocal() as db:
        job = await db.get(ProcessingJob, job_id)
        if not job:
            logger.error(f"Processing job {job_id} no longer exists")
            return

        job.current_stage = stage
        job.status = status
        job.progress_pct = STAGE_WEIGHTS.get(stage, job.progress_pct)

        if status == JobStatus.FAILED:
            job.error_message = message
        elif status in {JobStatus.RUNNING, JobStatus.SUCCEEDED}:
            job.error_message = None

        history = list(job.stage_history or [])
        history.append(
            {
                "stage": stage.value,
                "status": status.value,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        job.stage_history = history
        await db.commit()

    await ws_manager.broadcast(
        job_id,
        {
            "stage": stage.value,
            "status": status.value,
            "progress_pct": STAGE_WEIGHTS.get(stage, 0),
            "message": message,
        },
    )


async def _run_pipeline(upload_id: str, job_id: str) -> None:
    # Read the upload/job once. expire_on_commit=False keeps the values usable
    # after this short session closes.
    async with AsyncSessionLocal() as db:
        upload = await db.get(Upload, upload_id)
        job = await db.get(ProcessingJob, job_id)
        if not upload:
            raise ValueError(f"Upload {upload_id} not found")
        if not job:
            raise ValueError(f"Processing job {job_id} not found")

        upload.status = UploadStatus.QUEUED
        await db.commit()

    # ------------------------------------------------------------------
    # Stage 1-2: OCR + Document Parsing
    # ------------------------------------------------------------------
    await _update_job_stage(
        job_id, PipelineStage.OCR, JobStatus.RUNNING, "Starting document OCR/parsing"
    )

    ocr_service = OCRService()
    parsed = await ocr_service.parse(
        upload.storage_path,
        upload.file_type.value,
    )

    await _update_job_stage(
        job_id,
        PipelineStage.OCR,
        JobStatus.SUCCEEDED,
        f"OCR completed using {parsed.ocr_engine}",
    )
    await _update_job_stage(
        job_id,
        PipelineStage.DOCUMENT_PARSING,
        JobStatus.RUNNING,
        "Persisting parsed document",
    )

    async with AsyncSessionLocal() as db:
        document = Document(
            upload_id=upload_id,
            page_count=parsed.page_count,
            raw_text=parsed.raw_text,
            tables=parsed.tables,
            layout_metadata=parsed.layout_metadata,
            ocr_engine=parsed.ocr_engine,
            ocr_confidence=parsed.ocr_confidence,
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)

    await _update_job_stage(
        job_id,
        PipelineStage.DOCUMENT_PARSING,
        JobStatus.SUCCEEDED,
        "Document parsing completed",
    )

    # ------------------------------------------------------------------
    # Stages 3-9: LangGraph multi-agent pipeline
    # ------------------------------------------------------------------
    await _update_job_stage(
        job_id,
        PipelineStage.INFORMATION_EXTRACTION,
        JobStatus.RUNNING,
        "Starting multi-agent pipeline",
    )

    initial_state = {
        "upload_id": str(upload_id),
        "processing_job_id": str(job_id),
        "document_id": str(document.id),
        "file_path": upload.storage_path,
        "file_type": upload.file_type.value,
        "raw_text": parsed.raw_text,
        "tables": parsed.tables,
        "layout_metadata": parsed.layout_metadata,
        "ocr_confidence": parsed.ocr_confidence,
        "agent_logs": [],
        "errors": [],
    }

    final_state = dict(initial_state)

    # Stream node updates so the UI knows which actual agent is running.
    async for update in pipeline_graph.astream(
        initial_state,
        stream_mode="updates",
    ):
        for node_name, node_update in update.items():
            if isinstance(node_update, dict):
                final_state.update(node_update)

            stage = NODE_STAGES.get(node_name)
            if stage:
                await _update_job_stage(
                    job_id,
                    stage,
                    JobStatus.SUCCEEDED,
                    f"{node_name.replace('_', ' ').title()} completed",
                )

                # Set the next stage to RUNNING while preserving the actual
                # stage mapping used by the graph.
                if node_name == "extraction":
                    await _update_job_stage(
                        job_id, PipelineStage.VALIDATION, JobStatus.RUNNING,
                        "Validation agent started",
                    )
                elif node_name == "validation":
                    await _update_job_stage(
                        job_id, PipelineStage.RAG_SEARCH, JobStatus.RUNNING,
                        "RAG/reasoning stage started",
                    )
                elif node_name == "reasoning":
                    await _update_job_stage(
                        job_id, PipelineStage.KNOWLEDGE_GRAPH, JobStatus.RUNNING,
                        "Knowledge graph stage started",
                    )
                elif node_name == "knowledge_graph":
                    await _update_job_stage(
                        job_id, PipelineStage.LLM_GENERATION, JobStatus.RUNNING,
                        "Generation and enrichment agents started",
                    )
                elif node_name in {"seo", "recommendation", "compliance"}:
                    await _update_job_stage(
                        job_id, PipelineStage.LLM_GENERATION, JobStatus.RUNNING,
                        "Generation/enrichment agents running",
                    )

    # ------------------------------------------------------------------
    # Persist explainability + generated product
    # ------------------------------------------------------------------
    async with AsyncSessionLocal() as db:
        for log in final_state.get("agent_logs", []):
            output = log.get("output") or {}
            db.add(
                AIResult(
                    processing_job_id=job_id,
                    agent_name=log["agent_name"],
                    # Short human-readable summary of what this agent saw/did,
                    # shown alongside output/confidence in the Explainable AI
                    # panel (see AgentResultRead / evidence endpoint).
                    input_summary=f"stage output keys: {', '.join(output.keys())}" if output else None,
                    output=output,
                    # Populated only when an agent actually attached source
                    # attribution to its output; we never invent references
                    # that don't exist (see spec section 13).
                    source_attribution=output.get("source_attribution"),
                    confidence=log.get("confidence"),
                    latency_ms=log.get("latency_ms"),
                )
            )

        requires_review = final_state.get("requires_human_review", True)
        generated = final_state.get("generated_product", {})

        product = Product(
            upload_id=upload_id,
            status=(
                ProductStatus.PENDING_REVIEW
                if requires_review
                else ProductStatus.APPROVED
            ),
            confidence_score=final_state.get("overall_confidence"),
            **{
                k: v
                for k, v in generated.items()
                if k in {
                    "name",
                    "sku",
                    "category",
                    "description",
                    "specifications",
                    "technical_details",
                    "attributes",
                    "applications",
                    "seo_title",
                    "seo_description",
                    "seo_keywords",
                    "image_urls",
                    "related_product_ids",
                }
            },
        )
        db.add(product)

        job = await db.get(ProcessingJob, job_id)
        upload_db = await db.get(Upload, upload_id)
        job.status = (
            JobStatus.NEEDS_REVIEW if requires_review else JobStatus.SUCCEEDED
        )
        job.current_stage = (
            PipelineStage.HUMAN_REVIEW if requires_review else PipelineStage.COMPLETED
        )
        job.progress_pct = STAGE_WEIGHTS[job.current_stage]
        job.error_message = None
        upload_db.status = UploadStatus.READY
        await db.commit()

    final_stage = (
        PipelineStage.HUMAN_REVIEW
        if requires_review
        else PipelineStage.COMPLETED
    )
    await _update_job_stage(
        job_id,
        final_stage,
        JobStatus.NEEDS_REVIEW if requires_review else JobStatus.SUCCEEDED,
        "Human review required" if requires_review else "Pipeline completed successfully",
    )


@celery_app.task(name="process_upload", bind=True, max_retries=2)
def process_upload(self, upload_id: str, job_id: str):
    logger.info(f"Starting pipeline for upload={upload_id} job={job_id}")
    try:
        # Celery is run with --pool=solo on Windows, so one asyncio loop is
        # owned by the worker task and all async services share that loop.
        asyncio.run(_run_pipeline(upload_id, job_id))
    except Exception as exc:  # noqa: BLE001
        logger.exception(f"Pipeline failed for job {job_id}: {exc}")

        async def mark_failed():
            async with AsyncSessionLocal() as db:
                job = await db.get(ProcessingJob, job_id)
                stage = job.current_stage if job else PipelineStage.OCR

            await _update_job_stage(
                job_id,
                stage,
                JobStatus.FAILED,
                f"{type(exc).__name__}: {exc}",
            )

        try:
            asyncio.run(mark_failed())
        except Exception:
            logger.exception(f"Could not persist failure state for job {job_id}")

        raise self.retry(exc=exc, countdown=30)
