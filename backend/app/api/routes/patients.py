import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Patient,
    PatientCreate,
    PatientPublic,
    PatientsPublic,
    PatientUpdate,
    get_datetime_utc,
)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("/", response_model=PatientsPublic)
def read_patients(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    has_alert: bool | None = None,
) -> Any:
    """
    Retrieve patients. `q` matches first/last name or recent diagnosis.
    """
    statement = select(Patient)
    if q:
        like = f"%{q}%"
        statement = statement.where(
            or_(
                col(Patient.first_name).ilike(like),
                col(Patient.last_name).ilike(like),
                col(Patient.recent_diagnosis).ilike(like),
            )
        )
    if has_alert is not None:
        statement = statement.where(Patient.has_alert == has_alert)

    count = session.exec(select(func.count()).select_from(statement.subquery())).one()
    patients = session.exec(
        statement.order_by(col(Patient.last_name), col(Patient.first_name))
        .offset(skip)
        .limit(limit)
    ).all()
    return PatientsPublic(
        data=[PatientPublic.model_validate(p) for p in patients], count=count
    )


@router.get("/{id}", response_model=PatientPublic)
def read_patient(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    patient = session.get(Patient, id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/", response_model=PatientPublic)
def create_patient(
    *, session: SessionDep, current_user: CurrentUser, patient_in: PatientCreate
) -> Any:
    patient = Patient.model_validate(patient_in)
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient


@router.put("/{id}", response_model=PatientPublic)
def update_patient(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    patient_in: PatientUpdate,
) -> Any:
    patient = session.get(Patient, id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.sqlmodel_update(patient_in.model_dump(exclude_unset=True))
    patient.updated_at = get_datetime_utc()
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient


@router.delete("/{id}")
def delete_patient(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    patient = session.get(Patient, id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    session.delete(patient)
    session.commit()
    return Message(message="Patient deleted successfully")
