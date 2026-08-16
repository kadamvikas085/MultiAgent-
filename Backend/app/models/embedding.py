from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Embedding(Base, UUIDMixin, TimestampMixin):
    """
    Postgres keeps a pointer + metadata; the actual vector lives in Qdrant.
    This lets us join embeddings back to source entities relationally.
    """

    __tablename__ = "embeddings"

    source_type: Mapped[str] = mapped_column(String(32))  # "document" | "product"
    source_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    qdrant_point_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    dimensions: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)


