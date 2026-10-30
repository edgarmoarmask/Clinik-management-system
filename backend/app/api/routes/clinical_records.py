import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ClinicalRecord,
    ClinicalRecordCreate,
    ClinicalRecordPublic,
    ClinicalRecordsPublic,
    ClinicalRecordUpdate,
    Message,
    Patient,
    VisitType,
    get_datetime_utc,
)

router = APIRouter(prefix="/clinical-records", tags=["clinical-records"])


@router.get("/", response_model=ClinicalRecordsPublic)
def read_clinical_records(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    patient_id: uuid.UUID | None = None,
    visit_type: VisitType | None = None,
) -> Any:
    """
    Retrieve clinical records, newest visit first. Filter by patient and/or visit type.
    """
    statement = select(ClinicalRecord)
    if patient_id:
        statement = statement.where(ClinicalRecord.patient_id == patient_id)
    if visit_type:
        statement = statement.where(ClinicalRecord.visit_type == visit_type)

    count = session.exec(select(func.count()).select_from(statement.subquery())).one()
    records = session.exec(
        statement.order_by(col(ClinicalRecord.visit_date).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return ClinicalRecordsPublic(
        data=[ClinicalRecordPublic.model_validate(r) for r in records], count=count
    )


@router.get("/{id}", response_model=ClinicalRecordPublic)
def read_clinical_record(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    record = session.get(ClinicalRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    return record


@router.post("/", response_model=ClinicalRecordPublic)
def create_clinical_record(
    *, session: SessionDep, current_user: CurrentUser, record_in: ClinicalRecordCreate
) -> Any:
    if not session.get(Patient, record_in.patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    record = ClinicalRecord.model_validate(record_in)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.put("/{id}", response_model=ClinicalRecordPublic)
def update_clinical_record(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    record_in: ClinicalRecordUpdate,
) -> Any:
    record = session.get(ClinicalRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    record.sqlmodel_update(record_in.model_dump(exclude_unset=True))
    record.updated_at = get_datetime_utc()
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.delete("/{id}")
def delete_clinical_record(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    record = session.get(ClinicalRecord, id)
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    session.delete(record)
    session.commit()
    return Message(message="Clinical record deleted successfully")
