import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.processing_job import JobStatus, PipelineStage


class StageEvent(BaseModel):
    stage: PipelineStage
    status: JobStatus
    progress_pct: float
    message: str | None = None
    timestamp: datetime


class ProcessingJobRead(BaseModel):
    id: uuid.UUID
    upload_id: uuid.UUID
    current_stage: PipelineStage
    status: JobStatus
    progress_pct: float
    stage_history: list[dict] | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentResultRead(BaseModel):
    # NOTE: this is what powers the "Agent reasoning" / Evidence panels in the
    # frontend. It reads straight off the AIResult ORM model
    # (app/models/ai_result.py), so it MUST declare from_attributes=True —
    # without it, Pydantic v2 refuses to build the model from a SQLAlchemy
    # instance and FastAPI's response_model serialization throws a 500
    # (Internal Server Error) instead of returning the row.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    processing_job_id: uuid.UUID
    agent_name: str
    input_summary: str | None = None
    output: dict | None = None
    source_attribution: dict | None = None
    confidence: float | None = None
    latency_ms: int | None = None
    created_at: datetime


