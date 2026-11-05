from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep, require_role
from app.coa import ACCOUNTS_BY_CODE, CHART_OF_ACCOUNTS, Account, AccountType
from app.models import (
    Payment,
    PaymentStatus,
    ProfitAndLoss,
    ReportLine,
    UserRole,
    assume_utc,
)

router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/accounts", response_model=list[Account])
def list_accounts(current_user: CurrentUser):
    """The chart of accounts, for account pickers."""
    return CHART_OF_ACCOUNTS


@router.get(
    "/profit-and-loss",
    response_model=ProfitAndLoss,
    dependencies=[Depends(require_role(UserRole.CASHIER))],
)
def profit_and_loss(
    session: SessionDep,
    start: datetime | None = None,
    end: datetime | None = None,
):
    """Paid amounts per account between `start` (inclusive) and `end`
    (exclusive), by payment date."""
    stmt = (
        select(Payment.account_code, func.sum(Payment.amount))
        .where(Payment.status == PaymentStatus.PAID)
        .group_by(Payment.account_code)
    )
    if start:
        stmt = stmt.where(col(Payment.paid_at) >= assume_utc(start))
    if end:
        stmt = stmt.where(col(Payment.paid_at) < assume_utc(end))

    sections: dict[AccountType, list[ReportLine]] = {
        AccountType.REVENUE: [],
        AccountType.COGS: [],
        AccountType.EXPENSE: [],
    }
    for code, amount in session.exec(stmt).all():
        account = ACCOUNTS_BY_CODE.get(code)
        if account and account.type in sections:
            sections[account.type].append(
                ReportLine(code=code, name=account.name, amount=amount)
            )

    def total(lines: list[ReportLine]) -> Decimal:
        return sum((line.amount for line in lines), Decimal("0"))

    revenue = sorted(sections[AccountType.REVENUE], key=lambda line: line.code)
    cogs = sorted(sections[AccountType.COGS], key=lambda line: line.code)
    expenses = sorted(sections[AccountType.EXPENSE], key=lambda line: line.code)
    gross_profit = total(revenue) - total(cogs)
    return ProfitAndLoss(
        revenue=revenue,
        total_revenue=total(revenue),
        cost_of_sales=cogs,
        total_cost_of_sales=total(cogs),
        gross_profit=gross_profit,
        expenses=expenses,
        total_expenses=total(expenses),
        net_profit=gross_profit - total(expenses),
    )
