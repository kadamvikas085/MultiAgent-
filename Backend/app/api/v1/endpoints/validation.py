import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models.ai_result import AIResult
from app.models.audit_log import AuditLog
from app.models.processing_job import JobStatus, ProcessingJob
from app.models.product import Product, ProductStatus
from app.models.user import User, UserRole
from app.schemas.pipeline import AgentResultRead
from app.schemas.product import ProductRead

router = APIRouter(prefix="/validation", tags=["Validation Center"])


class EvidenceResponse(BaseModel):
    product: ProductRead
    agent_results: list[AgentResultRead]


@router.get("/queue", response_model=list[ProductRead])
async def get_review_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Products currently awaiting human review, with their source attribution."""
    products = (
        await db.scalars(
            select(Product).where(Product.status == ProductStatus.PENDING_REVIEW)
        )
    ).all()
    return products


@router.get("/{product_id}/evidence", response_model=EvidenceResponse)
async def get_evidence(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Field-level source attribution + agent confidence for the review UI."""
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    job = await db.scalar(
        select(ProcessingJob).where(ProcessingJob.upload_id == product.upload_id)
    )
    agent_results = (
        (await db.scalars(select(AIResult).where(AIResult.processing_job_id == job.id))).all()
        if job
        else []
    )
    return EvidenceResponse(
        product=ProductRead.model_validate(product),
        agent_results=[AgentResultRead.model_validate(r) for r in agent_results],
    )


@router.post("/{product_id}/approve", dependencies=[Depends(require_roles(UserRole.REVIEWER, UserRole.ADMIN))])
async def approve_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = ProductStatus.APPROVED
    db.add(
        AuditLog(user_id=current_user.id, action="product.approve", resource_id=product_id)
    )
    await db.commit()
    return {"status": "approved"}


@router.post("/{product_id}/reject", dependencies=[Depends(require_roles(UserRole.REVIEWER, UserRole.ADMIN))])
async def reject_product(
    product_id: uuid.UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = ProductStatus.REJECTED
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="product.reject",
            resource_id=product_id,
            metadata_={"reason": reason},
        )
    )
    await db.commit()
    return {"status": "rejected"}


