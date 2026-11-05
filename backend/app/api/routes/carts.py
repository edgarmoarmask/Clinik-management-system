import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.models import (
    Cart,
    CartItem,
    CartItemCreate,
    CartItemRead,
    CartItemUpdate,
    CartRead,
    CartStatus,
    Payment,
    PaymentRead,
    Product,
)
from app.api.deps import CurrentUser, SessionDep
from app.coa import CHECKOUT_REVENUE_ACCOUNT

router = APIRouter(prefix="/cart", tags=["cart"])
TWO_PLACES = Decimal("0.01")


# ---------------------------------------------------------------- helpers
def get_active_cart(
    session: SessionDep, user_id: uuid.UUID, create: bool = True
) -> Optional[Cart]:
    cart = session.exec(
        select(Cart).where(Cart.user_id == user_id, Cart.status == CartStatus.ACTIVE)
    ).first()
    if not cart and create:
        cart = Cart(user_id=user_id)
        session.add(cart)
        session.commit()
        session.refresh(cart)
    return cart


def check_sellable(product: Optional[Product], quantity: int) -> Product:
    if not product or not product.is_active:
        raise HTTPException(404, "Product not available")
    if product.expiry_date and product.expiry_date <= date.today():
        raise HTTPException(400, f"{product.name} is expired")
    if product.stock < quantity:
        raise HTTPException(409, f"Only {product.stock} of {product.name} in stock")
    return product


def to_cart_read(session: SessionDep, cart: Cart) -> CartRead:
    items, total = [], Decimal("0")
    for it in cart.items:
        product = session.get(Product, it.product_id)
        line = (it.unit_price * it.quantity).quantize(TWO_PLACES)
        total += line
        items.append(
            CartItemRead(
                id=it.id,
                product_id=it.product_id,
                product_name=product.name,
                quantity=it.quantity,
                unit_price=it.unit_price,
                line_total=line,
                requires_prescription=product.requires_prescription,
                prescription_ref=it.prescription_ref,
            )
        )
    return CartRead(
        id=cart.id, user_id=cart.user_id, status=cart.status, items=items, total=total
    )


def get_item(session: SessionDep, cart: Cart, item_id: int) -> CartItem:
    item = session.get(CartItem, item_id)
    if not item or item.cart_id != cart.id:
        raise HTTPException(404, "Cart item not found")
    return item


# -------------------------------------------------------------- endpoints
@router.get("", response_model=CartRead)
def view_cart(session: SessionDep, current_user: CurrentUser):
    return to_cart_read(session, get_active_cart(session, current_user.id))


@router.post("/items", response_model=CartRead, status_code=201)
def add_item(payload: CartItemCreate, session: SessionDep, current_user: CurrentUser):
    cart = get_active_cart(session, current_user.id)
    existing = next((i for i in cart.items if i.product_id == payload.product_id), None)
    new_qty = payload.quantity + (existing.quantity if existing else 0)
    product = check_sellable(session.get(Product, payload.product_id), new_qty)

    if existing:
        existing.quantity = new_qty
        existing.unit_price = product.price
        if payload.prescription_ref:
            existing.prescription_ref = payload.prescription_ref
        session.add(existing)
    else:
        session.add(
            CartItem(
                cart_id=cart.id,
                product_id=product.id,
                quantity=payload.quantity,
                unit_price=product.price,
                prescription_ref=payload.prescription_ref,
            )
        )
    session.commit()
    session.refresh(cart)
    return to_cart_read(session, cart)


@router.patch("/items/{item_id}", response_model=CartRead)
def update_item(
    item_id: int,
    payload: CartItemUpdate,
    session: SessionDep,
    current_user: CurrentUser,
):
    cart = get_active_cart(session, current_user.id)
    item = get_item(session, cart, item_id)
    if payload.quantity is not None:
        check_sellable(session.get(Product, item.product_id), payload.quantity)
        item.quantity = payload.quantity
    if payload.prescription_ref is not None:
        item.prescription_ref = payload.prescription_ref
    session.add(item)
    session.commit()
    session.refresh(cart)
    return to_cart_read(session, cart)


@router.delete("/items/{item_id}", response_model=CartRead)
def remove_item(item_id: int, session: SessionDep, current_user: CurrentUser):
    cart = get_active_cart(session, current_user.id)
    session.delete(get_item(session, cart, item_id))
    session.commit()
    session.refresh(cart)
    return to_cart_read(session, cart)


@router.delete("", response_model=CartRead)
def clear_cart(session: SessionDep, current_user: CurrentUser):
    cart = get_active_cart(session, current_user.id)
    for item in list(cart.items):
        session.delete(item)
    session.commit()
    session.refresh(cart)
    return to_cart_read(session, cart)


@router.post("/checkout", response_model=PaymentRead, status_code=201)
def checkout(session: SessionDep, current_user: CurrentUser):
    """Validate the cart, reserve stock, and create a pending payment."""
    cart = get_active_cart(session, current_user.id, create=False)
    if not cart or not cart.items:
        raise HTTPException(400, "Cart is empty")

    total = Decimal("0")
    for item in cart.items:
        product = check_sellable(session.get(Product, item.product_id), item.quantity)
        if product.requires_prescription and not item.prescription_ref:
            raise HTTPException(
                400, f"{product.name} requires a prescription reference"
            )
        item.unit_price = product.price  # re-price at current catalogue price
        product.stock -= item.quantity  # reserve stock
        total += product.price * item.quantity
        session.add_all([item, product])

    cart.status = CartStatus.CHECKED_OUT
    payment = Payment(
        cart_id=cart.id,
        user_id=current_user.id,
        amount=total.quantize(TWO_PLACES),
        account_code=CHECKOUT_REVENUE_ACCOUNT,
    )
    session.add_all([cart, payment])
    session.commit()  # single transaction: stock, cart and payment change together
    session.refresh(payment)
    return payment
