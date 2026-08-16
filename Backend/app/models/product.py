import enum

from sqlalchemy import Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ProductStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"


class Product(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "products"

    upload_id: Mapped[UUID] = mapped_column(ForeignKey("uploads.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    specifications: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    technical_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    attributes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    applications: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    seo_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    seo_keywords: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    image_urls: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    related_product_ids: Mapped[list | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status"), default=ProductStatus.DRAFT
    )


