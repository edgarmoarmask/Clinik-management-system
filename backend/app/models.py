import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from pydantic import EmailStr
from sqlalchemy import JSON, String
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import DateTime


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


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
    last_visit: date | None = None
    has_alert: bool = False
    alert_message: str | None = Field(default=None, max_length=1000)


class PatientCreate(PatientBase):
    pass


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
    last_visit: date | None = None
    has_alert: bool | None = None
    alert_message: str | None = Field(default=None, max_length=1000)


class Patient(PatientBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)
    records: list[ClinicalRecord] = Relationship(
        back_populates="patient", cascade_delete=True
    )
    prescriptions: list[Prescription] = Relationship(
        back_populates="patient", cascade_delete=True
    )


class PatientPublic(PatientBase):
    id: uuid.UUID
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
    prescribed_by: str = Field(min_length=1, max_length=255)
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
    prescribed_by: str | None = Field(default=None, min_length=1, max_length=255)
    prescribed_date: date | None = None
    expiry_date: date | None = None
    status: PrescriptionStatus | None = None
    allergy_checked: bool | None = None


class Prescription(PrescriptionBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    patient_id: uuid.UUID = Field(
        foreign_key="patient.id", nullable=False, ondelete="CASCADE", index=True
    )
    patient: Patient | None = Relationship(back_populates="prescriptions")
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)


class PrescriptionPublic(PrescriptionBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PrescriptionsPublic(SQLModel):
    data: list[PrescriptionPublic]
    count: int







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
