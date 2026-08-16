from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Document(Base, UUIDMixin, TimestampMixin):
    """A parsed representation of an Upload — text, tables, and layout metadata."""

    __tablename__ = "documents"

    upload_id: Mapped[UUID] = mapped_column(ForeignKey("uploads.id"), nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, default=1)
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    tables: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    layout_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ocr_engine: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(nullable=True)


