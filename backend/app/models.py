import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from pydantic import EmailStr, field_validator
from sqlalchemy import JSON, String
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import DateTime


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


def assume_utc(value: datetime | None) -> datetime | None:
    """Timezone-less datetimes from clients are taken as UTC (the DB requires tz)."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


class UserRole(StrEnum):
    """Staff role. Superusers (admins) can do everything regardless of role."""

    DOCTOR = "doctor"
    CASHIER = "cashier"


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    role: UserRole | None = Field(default=None, sa_type=String(20))


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    role: UserRole | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    items: list[Item] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Clinical / EMR models (migrated from the Amplify Gen 2 data schema)
#
# Amplify used `allow.authenticated()` ("private") on every model: any signed-in
# user can read and write. The routes mirror that: a valid JWT is required, but
# records are clinic-wide, not scoped to an owner.
# ---------------------------------------------------------------------------
class PatientGender(StrEnum):
    M = "M"
    F = "F"
    OTHER = "Other"


class VisitType(StrEnum):
    CONSULTATION = "Consultation"
    LAB_RESULTS = "LabResults"
    FOLLOW_UP = "FollowUp"
    EMERGENCY = "Emergency"


class PrescriptionStatus(StrEnum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


# --- Patient ---------------------------------------------------------------
class PatientBase(SQLModel):
    first_name: str = Field(min_length=1, max_length=255)
    last_name: str = Field(min_length=1, max_length=255)
    gender: PatientGender | None = Field(default=None, sa_type=String(10))
    age: int = Field(ge=0, le=150)
    blood_group: str | None = Field(default=None, max_length=10)
    photo_url: str | None = Field(default=None, max_length=2048)
    recent_diagnosis: str | None = Field(default=None, max_length=1000)
    chronic_conditions: list[str] | None = Field(default=None, sa_type=JSON)
    physician_name: str | None = Field(default=None, max_length=255)
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    height_cm: float | None = Field(default=None, gt=0, le=300)
    # systolic/diastolic, e.g. "120/80"
    blood_pressure: str | None = Field(
        default=None, max_length=7, schema_extra={"pattern": r"^\d{2,3}/\d{2,3}$"}
    )
    last_visit: date | None = None
    has_alert: bool = False
    alert_message: str | None = Field(default=None, max_length=1000)


class PatientCreate(PatientBase):
    # when given, physician_name is taken from this doctor
    physician_id: uuid.UUID | None = None


class PatientUpdate(SQLModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=255)
    last_name: str | None = Field(default=None, min_length=1, max_length=255)
    gender: PatientGender | None = None
    age: int | None = Field(default=None, ge=0, le=150)
    blood_group: str | None = Field(default=None, max_length=10)
    photo_url: str | None = Field(default=None, max_length=2048)
    recent_diagnosis: str | None = Field(default=None, max_length=1000)
    chronic_conditions: list[str] | None = None
    physician_name: str | None = Field(default=None, max_length=255)
    physician_id: uuid.UUID | None = None
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    height_cm: float | None = Field(default=None, gt=0, le=300)
    blood_pressure: str | None = Field(
        default=None, max_length=7, schema_extra={"pattern": r"^\d{2,3}/\d{2,3}$"}
    )
    last_visit: date | None = None
    has_alert: bool | None = None
    alert_message: str | None = Field(default=None, max_length=1000)


class Patient(PatientBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    physician_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)
    records: list[ClinicalRecord] = Relationship(
        back_populates="patient", cascade_delete=True
    )
    prescriptions: list[Prescription] = Relationship(
        back_populates="patient", cascade_delete=True
    )
    appointments: list[Appointment] = Relationship(
        back_populates="patient", cascade_delete=True
    )


class PatientPublic(PatientBase):
    id: uuid.UUID
    physician_id: uuid.UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PatientsPublic(SQLModel):
    data: list[PatientPublic]
    count: int


# --- ClinicalRecord --------------------------------------------------------
class ClinicalRecordBase(SQLModel):
    emr_number: str = Field(min_length=1, max_length=64)
    visit_date: datetime
    physician_name: str = Field(min_length=1, max_length=255)
    visit_type: VisitType | None = Field(default=None, sa_type=String(20))
    notes: str | None = None
    diagnosis: str | None = Field(default=None, max_length=1000)
    attachments: list[str] | None = Field(default=None, sa_type=JSON)

    _visit_date_utc = field_validator("visit_date")(assume_utc)


class ClinicalRecordCreate(ClinicalRecordBase):
    patient_id: uuid.UUID


class ClinicalRecordUpdate(SQLModel):
    emr_number: str | None = Field(default=None, min_length=1, max_length=64)
    visit_date: datetime | None = None
    physician_name: str | None = Field(default=None, min_length=1, max_length=255)
    visit_type: VisitType | None = None
    notes: str | None = None
    diagnosis: str | None = Field(default=None, max_length=1000)
    attachments: list[str] | None = None

    _visit_date_utc = field_validator("visit_date")(assume_utc)


class ClinicalRecord(ClinicalRecordBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    patient_id: uuid.UUID = Field(
        foreign_key="patient.id", nullable=False, ondelete="CASCADE", index=True
    )
    patient: Patient | None = Relationship(back_populates="records")
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)


class ClinicalRecordPublic(ClinicalRecordBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ClinicalRecordsPublic(SQLModel):
    data: list[ClinicalRecordPublic]
    count: int


# --- Prescription ----------------------------------------------------------
class PrescriptionBase(SQLModel):
    medication: str = Field(min_length=1, max_length=255)
    dosage: str = Field(min_length=1, max_length=255)
    frequency: str = Field(min_length=1, max_length=255)
    prescribed_date: date
    expiry_date: date | None = None
    status: PrescriptionStatus = Field(
        default=PrescriptionStatus.ACTIVE, sa_type=String(20)
    )
    allergy_checked: bool = False


class PrescriptionCreate(PrescriptionBase):
    patient_id: uuid.UUID


class PrescriptionUpdate(SQLModel):
    medication: str | None = Field(default=None, min_length=1, max_length=255)
    dosage: str | None = Field(default=None, min_length=1, max_length=255)
    frequency: str | None = Field(default=None, min_length=1, max_length=255)
    prescribed_date: date | None = None
    expiry_date: date | None = None
    status: PrescriptionStatus | None = None
    allergy_checked: bool | None = None


class Prescription(PrescriptionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # set by the server to the prescribing user's name; clients can't send it
    prescribed_by: str = Field(max_length=255)
    patient_id: uuid.UUID = Field(
        foreign_key="patient.id", nullable=False, ondelete="CASCADE", index=True
    )
    patient: Patient | None = Relationship(back_populates="prescriptions")
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)


class PrescriptionPublic(PrescriptionBase):
    id: uuid.UUID
    prescribed_by: str
    patient_id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PrescriptionsPublic(SQLModel):
    data: list[PrescriptionPublic]
    count: int


# --- Appointment -----------------------------------------------------------
class AppointmentStatus(StrEnum):
    SCHEDULED = "Scheduled"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    NO_SHOW = "NoShow"


class AppointmentBase(SQLModel):
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=5, le=480)
    reason: str | None = Field(default=None, max_length=1000)

    _scheduled_at_utc = field_validator("scheduled_at")(assume_utc)


class AppointmentCreate(AppointmentBase):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID


class AppointmentUpdate(SQLModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    reason: str | None = Field(default=None, max_length=1000)
    doctor_id: uuid.UUID | None = None
    status: AppointmentStatus | None = None

    _scheduled_at_utc = field_validator("scheduled_at")(assume_utc)


class Appointment(AppointmentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    patient_id: uuid.UUID = Field(
        foreign_key="patient.id", nullable=False, ondelete="CASCADE", index=True
    )
    doctor_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    status: AppointmentStatus = Field(
        default=AppointmentStatus.SCHEDULED, sa_type=String(20), index=True
    )
    created_by: uuid.UUID  # the cashier/admin who booked it
    patient: Patient | None = Relationship(back_populates="appointments")
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)


class AppointmentPublic(AppointmentBase):
    id: uuid.UUID
    duration_minutes: int  # always present in responses
    patient_id: uuid.UUID
    patient_name: str
    doctor_id: uuid.UUID
    doctor_name: str
    status: AppointmentStatus
    created_at: datetime | None = None


class AppointmentsPublic(SQLModel):
    data: list[AppointmentPublic]
    count: int


class DoctorPublic(SQLModel):
    id: uuid.UUID
    name: str


# Shared properties
class PharmacyBase(SQLModel):
    name: str = Field(min_length=1, max_length=255, index=True)
    license_number: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100, index=True)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=100)
    is_active: bool = True


# Properties to receive on creation
class PharmacyCreate(PharmacyBase):
    pass


# Properties to receive on update (everything optional)
class PharmacyUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    license_number: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


# Database model
class Pharmacy(PharmacyBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    updated_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


# Properties to return via API
class PharmacyPublic(PharmacyBase):
    id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PharmaciesPublic(SQLModel):
    data: list[PharmacyPublic]
    count: int


from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- Product
class ProductBase(SQLModel):
    sku: str = Field(index=True, unique=True, max_length=50)
    name: str = Field(index=True, max_length=200)
    generic_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    dosage_form: Optional[str] = Field(default=None, max_length=50)  # tablet, syrup...
    strength: Optional[str] = Field(default=None, max_length=50)  # e.g. 500 mg
    manufacturer: Optional[str] = Field(default=None, max_length=200)
    price: Decimal = Field(max_digits=10, decimal_places=2, gt=0)
    stock: int = Field(default=0, ge=0)
    requires_prescription: bool = False
    expiry_date: Optional[date] = None
    is_active: bool = True


class Product(ProductBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)


class ProductCreate(ProductBase):
    pass


class ProductRead(ProductBase):
    id: int


class ProductUpdate(SQLModel):
    name: Optional[str] = None
    generic_name: Optional[str] = None
    description: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    manufacturer: Optional[str] = None
    price: Optional[Decimal] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    requires_prescription: Optional[bool] = None
    expiry_date: Optional[date] = None
    is_active: Optional[bool] = None


# ------------------------------------------------------------------- Cart
class CartStatus(str, Enum):
    ACTIVE = "active"
    CHECKED_OUT = "checked_out"  # awaiting / completed payment


class Cart(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: uuid.UUID = Field(index=True)
    status: CartStatus = Field(default=CartStatus.ACTIVE, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    items: list["CartItem"] = Relationship(
        back_populates="cart", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class CartItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    cart_id: int = Field(foreign_key="cart.id", index=True)
    product_id: int = Field(foreign_key="product.id")
    quantity: int = Field(ge=1)
    unit_price: Decimal = Field(max_digits=10, decimal_places=2)  # price snapshot
    prescription_ref: Optional[str] = Field(default=None, max_length=100)
    cart: Optional[Cart] = Relationship(back_populates="items")


class CartItemCreate(SQLModel):
    product_id: int
    quantity: int = Field(default=1, ge=1)
    prescription_ref: Optional[str] = None


class CartItemUpdate(SQLModel):
    quantity: Optional[int] = Field(default=None, ge=1)
    prescription_ref: Optional[str] = None


class CartItemRead(SQLModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    requires_prescription: bool
    prescription_ref: Optional[str]


class CartRead(SQLModel):
    id: int
    user_id: uuid.UUID
    status: CartStatus
    items: list[CartItemRead]
    total: Decimal


# ---------------------------------------------------------------- Payment
class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    EWALLET = "ewallet"


class PaymentKind(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class Payment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # None for payments recorded manually in accounting (not from a checkout)
    cart_id: Optional[int] = Field(default=None, foreign_key="cart.id", index=True)
    user_id: uuid.UUID = Field(index=True)
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    kind: PaymentKind = Field(default=PaymentKind.INCOME, index=True)
    # chart of accounts code (app/coa.py): revenue for income, COGS/expense for expenses
    account_code: str = Field(max_length=10, index=True)
    method: Optional[PaymentMethod] = None
    status: PaymentStatus = Field(default=PaymentStatus.PENDING, index=True)
    transaction_ref: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=utcnow)
    paid_at: Optional[datetime] = None


class PaymentRead(SQLModel):
    id: int
    cart_id: Optional[int]
    user_id: uuid.UUID
    amount: Decimal
    kind: PaymentKind
    account_code: str
    method: Optional[PaymentMethod]
    status: PaymentStatus
    transaction_ref: Optional[str]
    description: Optional[str]
    created_at: datetime
    paid_at: Optional[datetime]


class PaymentConfirm(SQLModel):
    """Result reported by your payment gateway / cashier."""

    success: bool
    method: PaymentMethod
    transaction_ref: Optional[str] = None


class PaymentCreate(SQLModel):
    """A payment recorded manually in accounting: money received (income)
    or money spent (expense). Amounts are always positive."""

    amount: Decimal = Field(max_digits=12, decimal_places=2, gt=0)
    kind: PaymentKind = PaymentKind.INCOME
    account_code: str = Field(max_length=10)
    method: PaymentMethod
    status: PaymentStatus = PaymentStatus.PAID
    transaction_ref: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


class PaymentsPublic(SQLModel):
    data: list[PaymentRead]
    count: int


class PaymentSummary(SQLModel):
    """Totals of paid income/expenses; counts are of income payments."""

    total_paid: Decimal
    total_expenses: Decimal
    profit: Decimal
    total_pending: Decimal
    count_paid: int
    count_pending: int
    count_failed: int
    count_cancelled: int


class ReportLine(SQLModel):
    code: str
    name: str
    amount: Decimal


class ProfitAndLoss(SQLModel):
    """Cash-basis P&L: paid payments only, grouped by account."""

    revenue: list[ReportLine]
    total_revenue: Decimal
    cost_of_sales: list[ReportLine]
    total_cost_of_sales: Decimal
    gross_profit: Decimal
    expenses: list[ReportLine]
    total_expenses: Decimal
    net_profit: Decimal
