import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    action: str
    resource_type: str | None = None
    resource_id: uuid.UUID | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
