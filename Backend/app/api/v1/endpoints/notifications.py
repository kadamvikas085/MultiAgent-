"""
Notifications Endpoints
--------------------------
Simple polling-based notification inbox (pipeline completions, review
requests, system alerts). Real-time delivery for pipeline events happens over
the /pipeline/ws/{job_id} WebSocket; this is for the notification bell/inbox.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.product import Product, ProductStatus
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Derived notifications: for now, surfaces products awaiting this user's
    review. Swap for a dedicated Notification table if per-user read/unread
    tracking is needed."""
    pending = (
        await db.scalars(
            select(Product)
            .where(Product.status == ProductStatus.PENDING_REVIEW)
            .order_by(Product.created_at.desc())
            .limit(20)
        )
    ).all()
    return [
        {
            "id": p.id,
            "type": "review_requested",
            "message": f'"{p.name}" needs review (confidence {p.confidence_score})',
            "created_at": p.created_at,
        }
        for p in pending
    ]


