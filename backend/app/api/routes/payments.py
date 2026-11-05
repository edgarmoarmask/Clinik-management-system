import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep, has_role, require_role
from app.coa import ACCOUNTS_BY_CODE, EXPENSE_TYPES, INCOME_TYPES
from app.models import (
    Cart,
    CartStatus,
    Payment,
    PaymentConfirm,
    PaymentCreate,
    PaymentKind,
    PaymentRead,
    PaymentsPublic,
    PaymentStatus,
    PaymentSummary,
    Product,
    UserRole,
)

router = APIRouter(prefix="/payments", tags=["payments"])


def get_payment(session: SessionDep, payment_id: int, user: CurrentUser) -> Payment:
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if not has_role(user, UserRole.CASHIER) and payment.user_id != user.id:
        raise HTTPException(403, "Not enough permissions")
    return payment


def release_and_reopen(session: SessionDep, payment: Payment) -> None:
    """Return reserved stock and reopen the cart so the customer can retry."""
    if payment.cart_id is None:  # manual payment: no stock was reserved
        return
    cart = session.get(Cart, payment.cart_id)
    for item in cart.items:
        product = session.get(Product, item.product_id)
        product.stock += item.quantity
        session.add(product)
    cart.status = CartStatus.ACTIVE
    session.add(cart)


@router.get("", response_model=PaymentsPublic)
def list_payments(
    session: SessionDep,
    current_user: CurrentUser,
    user_id: Optional[uuid.UUID] = None,
    status: Optional[PaymentStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """Cashiers and superusers see all payments; other users only their own."""
    stmt = select(Payment)
    if not has_role(current_user, UserRole.CASHIER):
        stmt = stmt.where(Payment.user_id == current_user.id)
    elif user_id is not None:
        stmt = stmt.where(Payment.user_id == user_id)
    if status:
        stmt = stmt.where(Payment.status == status)
    count = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    data = session.exec(
        stmt.order_by(Payment.id.desc()).offset(skip).limit(limit)
    ).all()
    return PaymentsPublic(data=data, count=count)


@router.get("/summary", response_model=PaymentSummary)
def payments_summary(session: SessionDep, current_user: CurrentUser):
    stmt = select(
        Payment.kind,
        Payment.status,
        func.count(),
        func.coalesce(func.sum(Payment.amount), 0),
    )
    if not has_role(current_user, UserRole.CASHIER):
        stmt = stmt.where(Payment.user_id == current_user.id)
    rows = {
        (kind, status): (count, total)
        for kind, status, count, total in session.exec(
            stmt.group_by(Payment.kind, Payment.status)
        ).all()
    }

    def get(kind: PaymentKind, status: PaymentStatus) -> tuple[int, Decimal]:
        return rows.get((kind, status), (0, Decimal("0")))

    income = PaymentKind.INCOME
    total_paid = get(income, PaymentStatus.PAID)[1]
    total_expenses = get(PaymentKind.EXPENSE, PaymentStatus.PAID)[1]
    return PaymentSummary(
        total_paid=total_paid,
        total_expenses=total_expenses,
        profit=total_paid - total_expenses,
        total_pending=get(income, PaymentStatus.PENDING)[1],
        count_paid=get(income, PaymentStatus.PAID)[0],
        count_pending=get(income, PaymentStatus.PENDING)[0],
        count_failed=get(income, PaymentStatus.FAILED)[0],
        count_cancelled=get(income, PaymentStatus.CANCELLED)[0],
    )


@router.post(
    "",
    response_model=PaymentRead,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.CASHIER))],
)
def create_payment(
    payload: PaymentCreate, session: SessionDep, current_user: CurrentUser
):
    """Record income received outside checkout, or an expense (accounting)."""
    account = ACCOUNTS_BY_CODE.get(payload.account_code)
    allowed = INCOME_TYPES if payload.kind == PaymentKind.INCOME else EXPENSE_TYPES
    if not account or account.is_header or account.type not in allowed:
        raise HTTPException(
            422,
            f"Account {payload.account_code} can't be used for {payload.kind.value}",
        )
    payment = Payment.model_validate(payload, update={"user_id": current_user.id})
    if payment.status == PaymentStatus.PAID:
        payment.paid_at = datetime.now(timezone.utc)
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentRead)
def read_payment(payment_id: int, session: SessionDep, current_user: CurrentUser):
    return get_payment(session, payment_id, current_user)


@router.post("/{payment_id}/confirm", response_model=PaymentRead)
def confirm_payment(
    payment_id: int,
    payload: PaymentConfirm,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Record the gateway/cashier result. Protect this route (or turn it into a
    signed webhook) before going to production."""
    payment = get_payment(session, payment_id, current_user)
    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(409, f"Payment already {payment.status.value}")

    payment.method = payload.method
    payment.transaction_ref = payload.transaction_ref
    if payload.success:
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.now(timezone.utc)
    else:
        payment.status = PaymentStatus.FAILED
        release_and_reopen(session, payment)
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


@router.post("/{payment_id}/cancel", response_model=PaymentRead)
def cancel_payment(payment_id: int, session: SessionDep, current_user: CurrentUser):
    payment = get_payment(session, payment_id, current_user)
    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(409, f"Cannot cancel a {payment.status.value} payment")
    payment.status = PaymentStatus.CANCELLED
    release_and_reopen(session, payment)
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment
