"""
Global Search Endpoint
------------------------
Backs the command palette / global search: fuzzy-matches across products and
uploads so users can jump straight to a record.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.product import Product
from app.models.upload import Upload
from app.models.user import User

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("")
async def global_search(
    q: str = Query(min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    products = (
        await db.scalars(
            select(Product).where(Product.name.ilike(f"%{q}%")).limit(10)
        )
    ).all()
    uploads = (
        await db.scalars(
            select(Upload).where(Upload.file_name.ilike(f"%{q}%")).limit(10)
        )
    ).all()

    return {
        "products": [{"id": p.id, "type": "product", "title": p.name} for p in products],
        "uploads": [{"id": u.id, "type": "upload", "title": u.file_name} for u in uploads],
    }


