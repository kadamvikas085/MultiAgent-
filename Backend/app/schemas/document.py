import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.upload import UploadStatus, UploadType


class UploadCreateResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    file_type: UploadType
    status: UploadStatus
    processing_job_id: uuid.UUID | None = None


class UploadRead(BaseModel):
    id: uuid.UUID
    file_name: str
    file_type: UploadType
    file_size_bytes: int
    status: UploadStatus
    source_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WebsiteIngestRequest(BaseModel):
    url: str
    depth: int = 1


class DocumentRead(BaseModel):
    id: uuid.UUID
    upload_id: uuid.UUID
    page_count: int
    raw_text: str | None
    tables: list | None
    ocr_confidence: float | None

    model_config = {"from_attributes": True}


