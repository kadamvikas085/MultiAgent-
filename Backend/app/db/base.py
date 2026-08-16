"""
Declarative base + shared mixins used by every ORM model.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# Import all models here so Alembic's autogenerate can discover them
# through Base.metadata without needing manual imports elsewhere.
from app.models import (  # noqa: E402,F401
    user,
    document,
    upload,
    processing_job,
    product,
    embedding,
    knowledge_graph,
    ai_result,
    audit_log,
)


