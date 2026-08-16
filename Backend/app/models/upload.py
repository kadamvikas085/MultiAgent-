import enum

from sqlalchemy import BigInteger, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class UploadType(str, enum.Enum):
    PDF = "pdf"
    IMAGE = "image"
    EXCEL = "excel"
    WORD = "word"
    WEBSITE = "website"


class UploadStatus(str, enum.Enum):
    RECEIVED = "received"
    VALIDATING = "validating"
    QUEUED = "queued"
    FAILED = "failed"
    READY = "ready"


class Upload(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "uploads"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_type: Mapped[UploadType] = mapped_column(Enum(UploadType, name="upload_type"))
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[UploadStatus] = mapped_column(
        Enum(UploadStatus, name="upload_status"), default=UploadStatus.RECEIVED
    )
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)


