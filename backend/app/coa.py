"""Malaysian SME chart of accounts (MPERS/MFRS structure).

Payments and expenses are tagged with one of these account codes; the
accounting report groups paid amounts by account. Header accounts are
groupings only and cannot be posted to.
"""

from enum import StrEnum

from sqlmodel import SQLModel


class AccountType(StrEnum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    COGS = "COGS"
    EXPENSE = "EXPENSE"


class Account(SQLModel):
    code: str
    name: str
    name_bm: str | None = None
    type: AccountType
    parent: str | None = None
    is_header: bool = False


def _a(
    code: str,
    name: str,
    type: AccountType,
    parent: str | None = None,
    name_bm: str | None = None,
    is_header: bool = False,
) -> Account:
    return Account(
        code=code,
        name=name,
        name_bm=name_bm,
        type=type,
        parent=parent,
        is_header=is_header,
    )


A, L, E = AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY
R, C, X = AccountType.REVENUE, AccountType.COGS, AccountType.EXPENSE

CHART_OF_ACCOUNTS: list[Account] = [
    # 1xxx assets
    _a("1000", "Current Assets", A, is_header=True),
    _a("1010", "Cash in Hand", A, "1000", "Tunai di Tangan"),
    _a("1020", "Bank - Current Account", A, "1000", "Bank - Akaun Semasa"),
    _a("1030", "Card Settlement Clearing", A, "1000", "Penyelesaian Kad"),
    _a("1040", "E-Wallet Clearing (TNG/GrabPay/DuitNow QR)", A, "1000"),
    _a("1100", "Trade Receivables", A, "1000", "Penghutang Perdagangan"),
    _a("1150", "Deposits & Prepayments", A, "1000", "Deposit & Bayaran Terdahulu"),
    _a("1200", "Inventory - Products/Supplies", A, "1000", "Inventori"),
    _a("1500", "Non-Current Assets", A, is_header=True),
    _a("1510", "Equipment & Machinery", A, "1500"),
    _a("1511", "Accum. Depreciation - Equipment", A, "1500"),
    _a("1520", "Furniture & Fittings", A, "1500"),
    _a("1521", "Accum. Depreciation - Furniture", A, "1500"),
    _a("1530", "Renovation", A, "1500"),
    _a("1531", "Accum. Depreciation - Renovation", A, "1500"),
    _a("1540", "Computers & IT Equipment", A, "1500"),
    _a("1541", "Accum. Depreciation - IT", A, "1500"),
    # 2xxx liabilities
    _a("2000", "Current Liabilities", L, is_header=True),
    _a("2010", "Trade Payables", L, "2000", "Pemiutang Perdagangan"),
    _a("2020", "Accruals", L, "2000", "Akruan"),
    _a(
        "2030",
        "Customer Deposits / Unearned Revenue (packages)",
        L,
        "2000",
        "Deposit Pelanggan",
    ),
    _a("2100", "Service Tax Payable (SST)", L, "2000", "Cukai Perkhidmatan Kena Bayar"),
    _a("2110", "Sales Tax Payable (SST)", L, "2000", "Cukai Jualan Kena Bayar"),
    _a("2200", "EPF Payable (KWSP)", L, "2000"),
    _a("2210", "SOCSO Payable (PERKESO)", L, "2000"),
    _a("2220", "EIS Payable (SIP)", L, "2000"),
    _a("2230", "PCB / MTD Payable (LHDN)", L, "2000"),
    _a("2240", "HRD Corp Levy Payable (PSMB)", L, "2000"),
    _a("2250", "Salaries Payable", L, "2000"),
    _a("2300", "Income Tax Payable", L, "2000"),
    _a("2500", "Long-Term Loans", L, is_header=True),
    _a("2510", "Bank Term Loan", L, "2500"),
    _a("2520", "Director Loan / Amount Due to Directors", L, "2500"),
    # 3xxx equity
    _a("3000", "Equity", E, is_header=True),
    _a("3010", "Share Capital / Owner's Capital", E, "3000"),
    _a("3020", "Retained Earnings", E, "3000"),
    _a("3030", "Owner's Drawings / Dividends", E, "3000"),
    # 4xxx revenue
    _a("4000", "Revenue", R, is_header=True),
    _a("4010", "Service Revenue - Treatments", R, "4000"),
    _a("4020", "Service Revenue - Consultations", R, "4000"),
    _a("4030", "Package / Membership Revenue", R, "4000"),
    _a("4040", "Product Sales (Retail)", R, "4000"),
    _a("4050", "Walk-in Sales", R, "4000"),
    _a("4900", "Other Income", R, "4000"),
    _a("4910", "Interest Income", R, "4000"),
    # 5xxx cost of sales
    _a("5000", "Cost of Sales", C, is_header=True),
    _a("5010", "Cost of Products Sold", C, "5000"),
    _a("5020", "Consumables Used (treatment)", C, "5000"),
    _a("5030", "Therapist/Practitioner Direct Cost", C, "5000"),
    # 6xxx operating expenses
    _a("6000", "Operating Expenses", X, is_header=True),
    _a("6010", "Salaries & Wages", X, "6000"),
    _a("6011", "EPF - Employer", X, "6000"),
    _a("6012", "SOCSO - Employer", X, "6000"),
    _a("6013", "EIS - Employer", X, "6000"),
    _a("6014", "HRD Corp Levy", X, "6000"),
    _a("6020", "Rent", X, "6000", "Sewa"),
    _a("6030", "Utilities (TNB, Air Selangor, Internet)", X, "6000"),
    _a("6040", "Marketing & Advertising", X, "6000"),
    _a("6050", "Professional Fees (audit, tax, legal)", X, "6000"),
    _a("6060", "Repairs & Maintenance", X, "6000"),
    _a("6070", "Office & General Supplies", X, "6000"),
    _a("6080", "Licenses, Permits & Insurance", X, "6000"),
    _a("6090", "Bank & Card Merchant Charges", X, "6000"),
    _a("6100", "Depreciation", X, "6000"),
    _a("6110", "Software & Subscriptions", X, "6000"),
    _a("6120", "Travel & Transport", X, "6000"),
    _a("6900", "Miscellaneous Expense", X, "6000"),
    _a("6950", "Income Tax Expense", X, "6000"),
]

ACCOUNTS_BY_CODE = {a.code: a for a in CHART_OF_ACCOUNTS}

# Checkout sells catalogue products, so it posts to retail product sales.
CHECKOUT_REVENUE_ACCOUNT = "4040"

# Account types a payment of each kind may be tagged with.
INCOME_TYPES = {AccountType.REVENUE}
EXPENSE_TYPES = {AccountType.COGS, AccountType.EXPENSE}
