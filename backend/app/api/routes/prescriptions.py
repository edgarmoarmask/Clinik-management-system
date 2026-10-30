import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Patient,
    Prescription,
    PrescriptionCreate,
    PrescriptionPublic,
    PrescriptionsPublic,
    PrescriptionStatus,
    PrescriptionUpdate,
    get_datetime_utc,
)

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.get("/", response_model=PrescriptionsPublic)
def read_prescriptions(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    patient_id: uuid.UUID | None = None,
    status: PrescriptionStatus | None = None,
) -> Any:
    """
    Retrieve prescriptions, newest first. Filter by patient and/or status.
    """
    statement = select(Prescription)
    if patient_id:
        statement = statement.where(Prescription.patient_id == patient_id)
    if status:
        statement = statement.where(Prescription.status == status)

    count = session.exec(select(func.count()).select_from(statement.subquery())).one()
    prescriptions = session.exec(
        statement.order_by(col(Prescription.prescribed_date).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return PrescriptionsPublic(
        data=[PrescriptionPublic.model_validate(p) for p in prescriptions],
        count=count,
    )


@router.get("/{id}", response_model=PrescriptionPublic)
def read_prescription(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    prescription = session.get(Prescription, id)
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return prescription


@router.post("/", response_model=PrescriptionPublic)
def create_prescription(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    prescription_in: PrescriptionCreate,
) -> Any:
    if not session.get(Patient, prescription_in.patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    prescription = Prescription.model_validate(prescription_in)
    session.add(prescription)
    session.commit()
    session.refresh(prescription)
    return prescription


@router.put("/{id}", response_model=PrescriptionPublic)
def update_prescription(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    prescription_in: PrescriptionUpdate,
) -> Any:
    prescription = session.get(Prescription, id)
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    prescription.sqlmodel_update(prescription_in.model_dump(exclude_unset=True))
    prescription.updated_at = get_datetime_utc()
    session.add(prescription)
    session.commit()
    session.refresh(prescription)
    return prescription


@router.delete("/{id}")
def delete_prescription(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    prescription = session.get(Prescription, id)
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    session.delete(prescription)
    session.commit()
    return Message(message="Prescription deleted successfully")
