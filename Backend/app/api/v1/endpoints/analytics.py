"""
Analytics Endpoints
--------------------
Powers the Analytics page: processing time, accuracy, confidence trends,
extraction success rate, and dashboard KPI cards.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.processing_job import JobStatus, ProcessingJob
from app.models.product import Product
from app.models.upload import Upload
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
async def overview(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total_uploads = await db.scalar(
        select(func.count()).select_from(Upload).where(Upload.created_at >= since)
    )
    total_products = await db.scalar(
        select(func.count()).select_from(Product).where(Product.created_at >= since)
    )
    avg_confidence = await db.scalar(
        select(func.avg(Product.confidence_score)).where(Product.created_at >= since)
    )
    succeeded = await db.scalar(
        select(func.count())
        .select_from(ProcessingJob)
        .where(ProcessingJob.status == JobStatus.SUCCEEDED, ProcessingJob.created_at >= since)
    )
    failed = await db.scalar(
        select(func.count())
        .select_from(ProcessingJob)
        .where(ProcessingJob.status == JobStatus.FAILED, ProcessingJob.created_at >= since)
    )
    total_jobs = (succeeded or 0) + (failed or 0)
    success_rate = (succeeded / total_jobs) if total_jobs else None

    return {
        "total_uploads": total_uploads or 0,
        "total_products_generated": total_products or 0,
        "avg_confidence_score": round(avg_confidence, 3) if avg_confidence else None,
        "extraction_success_rate": round(success_rate, 3) if success_rate is not None else None,
        "window_days": days,
    }


@router.get("/processing-time-series")
async def processing_time_series(
    days: int = Query(14, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = await db.execute(
        select(
            func.date_trunc("day", ProcessingJob.created_at).label("day"),
            func.count().label("jobs"),
            func.avg(Product.confidence_score).label("avg_confidence"),
        )
        .join(Product, Product.upload_id == ProcessingJob.upload_id, isouter=True)
        .where(ProcessingJob.created_at >= since)
        .group_by("day")
        .order_by("day")
    )
    return [dict(r._mapping) for r in rows]


