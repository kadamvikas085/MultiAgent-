"""
Audit Log Endpoints
---------------------
Read-only trail of sensitive actions (approvals, rejections, bulk actions,
logins) for compliance and admin oversight.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogRead

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("", response_model=list[AuditLogRead], dependencies=[Depends(require_roles(UserRole.ADMIN))])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        await db.scalars(
            select(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return logs


