import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.product import ProductStatus


class ProductBase(BaseModel):
    name: str
    sku: str | None = None
    category: str | None = None
    description: str | None = None
    specifications: dict | None = None
    technical_details: dict | None = None
    attributes: dict | None = None
    applications: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: list[str] | None = None
    image_urls: list[str] | None = None


class ProductUpdate(BaseModel):
    """Used by the Validation Center for human-in-the-loop edits."""

    name: str | None = None
    category: str | None = None
    description: str | None = None
    specifications: dict | None = None
    technical_details: dict | None = None
    attributes: dict | None = None
    applications: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: list[str] | None = None
    status: ProductStatus | None = None


class ProductRead(ProductBase):
    id: uuid.UUID
    upload_id: uuid.UUID | None
    related_product_ids: list[uuid.UUID] | None = None
    confidence_score: float | None
    status: ProductStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListItem(BaseModel):
    id: uuid.UUID
    name: str
    category: str | None
    confidence_score: float | None
    status: ProductStatus
    created_at: datetime

    model_config = {"from_attributes": True}


