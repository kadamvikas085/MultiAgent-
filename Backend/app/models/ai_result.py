from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class AIResult(Base, UUIDMixin, TimestampMixin):
    """
    One row per agent invocation. Keeps the reasoning/output/source-attribution
    of every agent in the pipeline so the UI can show "why" behind a field
    (Explainable AI) and reviewers can trace a value back to its source span.
    """

    __tablename__ = "ai_results"

    processing_job_id: Mapped[UUID] = mapped_column(
        ForeignKey("processing_jobs.id"), nullable=False
    )
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False)
    input_summary: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    source_attribution: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(nullable=True)


