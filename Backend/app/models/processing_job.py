import enum

from sqlalchemy import Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class PipelineStage(str, enum.Enum):
    OCR = "ocr"
    DOCUMENT_PARSING = "document_parsing"
    INFORMATION_EXTRACTION = "information_extraction"
    KNOWLEDGE_GRAPH = "knowledge_graph"
    VALIDATION = "validation"
    RAG_SEARCH = "rag_search"
    LLM_GENERATION = "llm_generation"
    CONFIDENCE_SCORING = "confidence_scoring"
    HUMAN_REVIEW = "human_review"
    COMPLETED = "completed"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"


class ProcessingJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "processing_jobs"

    upload_id: Mapped[UUID] = mapped_column(ForeignKey("uploads.id"), nullable=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    current_stage: Mapped[PipelineStage] = mapped_column(
        Enum(PipelineStage, name="pipeline_stage"), default=PipelineStage.OCR
    )
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status"), default=JobStatus.PENDING
    )
    progress_pct: Mapped[float] = mapped_column(Float, default=0.0)
    stage_history: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


