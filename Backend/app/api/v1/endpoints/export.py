"""
Export Endpoints
-----------------
CSV / PDF export of the product catalog or a single generated product.
"""
import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.product import Product
from app.models.user import User

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/products/csv")
async def export_products_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    products = (await db.scalars(select(Product))).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "name", "sku", "category", "confidence_score", "status", "created_at"])
    for p in products:
        writer.writerow([p.id, p.name, p.sku, p.category, p.confidence_score, p.status.value, p.created_at])
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_export.csv"},
    )


@router.get("/products/{product_id}/json")
async def export_product_json(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """JSON export of a single generated product — the PDF layout is rendered
    client-side (see frontend export util) from this same payload."""
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


