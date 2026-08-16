import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.product import Product, ProductStatus
from app.models.user import User
from app.schemas.product import ProductListItem, ProductRead, ProductUpdate

router = APIRouter(prefix="/products", tags=["Product Catalog"])

# Safety limit for bulk operations.
# This protects the database from unexpectedly large requests while
# keeping the existing bulk-action functionality intact.
MAX_BULK_PRODUCTS = 100


@router.get("", response_model=dict)
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str | None = None,
    category: str | None = None,
    status: ProductStatus | None = None,
    sort_by: str = Query(
        "created_at",
        pattern="^(created_at|name|confidence_score)$",
    ),
    sort_dir: str = Query(
        "desc",
        pattern="^(asc|desc)$",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = select(Product)
    count_query = select(func.count()).select_from(Product)

    if search:
        clause = or_(
            Product.name.ilike(f"%{search}%"),
            Product.sku.ilike(f"%{search}%"),
            Product.description.ilike(f"%{search}%"),
        )

        query = query.where(clause)
        count_query = count_query.where(clause)

    if category:
        query = query.where(Product.category == category)
        count_query = count_query.where(Product.category == category)

    if status:
        query = query.where(Product.status == status)
        count_query = count_query.where(Product.status == status)

    sort_col = getattr(Product, sort_by)

    query = query.order_by(
        sort_col.desc()
        if sort_dir == "desc"
        else sort_col.asc()
    )

    query = query.offset(
        (page - 1) * page_size
    ).limit(page_size)

    total = await db.scalar(count_query)
    items = (await db.scalars(query)).all()

    return {
        "items": [
            ProductListItem.model_validate(p)
            for p in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (
            (total + page_size - 1) // page_size
            if total
            else 0
        ),
    }


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    return product


@router.patch("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(product, field, value)

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="product.update",
            resource_type="product",
            resource_id=product_id,
        )
    )

    await db.commit()
    await db.refresh(product)

    return product


@router.post("/bulk-action")
async def bulk_action(
    product_ids: list[uuid.UUID],
    action: str = Query(
        pattern="^(approve|reject|delete|publish)$"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Perform an action on multiple products.

    Safety protections:
      - At least one product must be supplied.
      - Maximum of 100 products per request.
      - Duplicate IDs are rejected.
      - Every requested product must exist.
    """

    # ---------------------------------------------------------------
    # BULK ACTION SAFETY
    # ---------------------------------------------------------------

    if not product_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one product ID is required.",
        )

    if len(product_ids) > MAX_BULK_PRODUCTS:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Bulk action is limited to "
                f"{MAX_BULK_PRODUCTS} products per request."
            ),
        )

    # Reject duplicate IDs so the request accurately represents the
    # number of products being modified.
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate product IDs are not allowed.",
        )

    # ---------------------------------------------------------------
    # LOAD ALL REQUESTED PRODUCTS
    # ---------------------------------------------------------------

    products = (
        await db.scalars(
            select(Product).where(
                Product.id.in_(product_ids)
            )
        )
    ).all()

    # Make sure every requested ID exists.
    found_ids = {product.id for product in products}
    missing_ids = [
        product_id
        for product_id in product_ids
        if product_id not in found_ids
    ]

    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=(
                f"{len(missing_ids)} requested product(s) "
                "were not found."
            ),
        )

    # ---------------------------------------------------------------
    # EXISTING BULK ACTION LOGIC
    # ---------------------------------------------------------------

    status_map = {
        "approve": ProductStatus.APPROVED,
        "reject": ProductStatus.REJECTED,
        "publish": ProductStatus.PUBLISHED,
    }

    if action == "delete":
        for product in products:
            await db.delete(product)

    else:
        for product in products:
            product.status = status_map[action]

    # ---------------------------------------------------------------
    # EXISTING AUDIT LOGGING
    # ---------------------------------------------------------------

    db.add(
        AuditLog(
            user_id=current_user.id,
            action=f"product.bulk_{action}",
            metadata_={
                "product_ids": [
                    str(product_id)
                    for product_id in product_ids
                ]
            },
        )
    )

    await db.commit()

    return {
        "updated": len(products),
        "action": action,
    }