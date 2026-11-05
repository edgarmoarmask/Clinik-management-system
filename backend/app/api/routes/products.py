from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import Product, ProductCreate, ProductRead, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.post(
    "",
    response_model=ProductRead,
    status_code=201,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_product(payload: ProductCreate, session: SessionDep):
    if session.exec(select(Product).where(Product.sku == payload.sku)).first():
        raise HTTPException(409, "SKU already exists")
    product = Product.model_validate(payload)
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


BATCH_LIMIT = 1000


@router.post(
    "/batch",
    response_model=list[ProductRead],
    status_code=201,
    dependencies=[Depends(get_current_active_superuser)],
)
def create_products_batch(payload: list[ProductCreate], session: SessionDep):
    """Create many products at once. All-or-nothing: if any SKU is repeated in
    the batch or already exists, nothing is created."""
    if not payload:
        raise HTTPException(400, "Batch is empty")
    if len(payload) > BATCH_LIMIT:
        raise HTTPException(400, f"Batch is limited to {BATCH_LIMIT} products")

    skus = Counter(p.sku for p in payload)
    repeated = sorted(sku for sku, n in skus.items() if n > 1)
    if repeated:
        raise HTTPException(409, f"SKUs repeated in batch: {', '.join(repeated)}")
    existing = session.exec(select(Product.sku).where(col(Product.sku).in_(skus))).all()
    if existing:
        raise HTTPException(409, f"SKUs already exist: {', '.join(sorted(existing))}")

    products = [Product.model_validate(p) for p in payload]
    session.add_all(products)
    session.commit()
    for product in products:
        session.refresh(product)
    return products


@router.get("", response_model=list[ProductRead])
def list_products(
    session: SessionDep,
    q: Optional[str] = Query(None, description="Search name or generic name"),
    requires_prescription: Optional[bool] = None,
    in_stock: bool = False,
    include_inactive: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    stmt = select(Product)
    if not include_inactive:
        stmt = stmt.where(Product.is_active == True)  # noqa: E712
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            col(Product.name).ilike(like) | col(Product.generic_name).ilike(like)
        )
    if requires_prescription is not None:
        stmt = stmt.where(Product.requires_prescription == requires_prescription)
    if in_stock:
        stmt = stmt.where(Product.stock > 0)
    return session.exec(stmt.order_by(Product.name).offset(skip).limit(limit)).all()


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: int, session: SessionDep):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.patch(
    "/{product_id}",
    response_model=ProductRead,
    dependencies=[Depends(get_current_active_superuser)],
)
def update_product(product_id: int, payload: ProductUpdate, session: SessionDep):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    product.sqlmodel_update(payload.model_dump(exclude_unset=True))
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@router.delete(
    "/{product_id}",
    status_code=204,
    dependencies=[Depends(get_current_active_superuser)],
)
def deactivate_product(product_id: int, session: SessionDep):
    """Soft delete: keeps history for past carts and payments."""
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    product.is_active = False
    session.add(product)
    session.commit()
