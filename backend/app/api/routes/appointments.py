import uuid
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep, has_role, require_role
from app.models import (
    Appointment,
    AppointmentCreate,
    AppointmentPublic,
    AppointmentsPublic,
    AppointmentStatus,
    AppointmentUpdate,
    DoctorPublic,
    Patient,
    User,
    UserRole,
    assume_utc,
    get_datetime_utc,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

# Cashiers book appointments; superusers pass every role check.
Booker = Annotated[User, Depends(require_role(UserRole.CASHIER))]


def display_name(user: User) -> str:
    return user.full_name or user.email


def to_public(session: SessionDep, appt: Appointment) -> AppointmentPublic:
    patient = session.get(Patient, appt.patient_id)
    doctor = session.get(User, appt.doctor_id)
    return AppointmentPublic.model_validate(
        appt,
        update={
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "doctor_name": display_name(doctor),
        },
    )


def get_doctor(session: SessionDep, doctor_id: uuid.UUID) -> User:
    doctor = session.get(User, doctor_id)
    if not doctor or not doctor.is_active or doctor.role != UserRole.DOCTOR:
        raise HTTPException(status_code=400, detail="Choose an active doctor")
    return doctor


def check_no_overlap(
    session: SessionDep,
    doctor_id: uuid.UUID,
    start: datetime,
    minutes: int,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Reject a booking that overlaps another scheduled one for the same doctor."""
    end = start + timedelta(minutes=minutes)
    # appointments are at most 8h long, so only nearby ones can overlap
    nearby = session.exec(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status == AppointmentStatus.SCHEDULED,
            col(Appointment.scheduled_at) > start - timedelta(hours=8),
            col(Appointment.scheduled_at) < end,
        )
    ).all()
    for other in nearby:
        other_end = other.scheduled_at + timedelta(minutes=other.duration_minutes)
        if other.id != exclude_id and other.scheduled_at < end and start < other_end:
            raise HTTPException(
                status_code=409,
                detail="The doctor already has an appointment at that time",
            )


def get_visible(session: SessionDep, user: User, id: uuid.UUID) -> Appointment:
    appt = session.get(Appointment, id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not has_role(user, UserRole.CASHIER) and appt.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return appt


@router.get("/doctors", response_model=list[DoctorPublic])
def list_doctors(session: SessionDep, current_user: CurrentUser) -> Any:
    """Active users with the doctor role, for booking and patient forms."""
    doctors = session.exec(
        select(User).where(User.role == UserRole.DOCTOR, User.is_active == True)  # noqa: E712
    ).all()
    return sorted(
        (DoctorPublic(id=d.id, name=display_name(d)) for d in doctors),
        key=lambda d: d.name.lower(),
    )


@router.get("/", response_model=AppointmentsPublic)
def read_appointments(
    session: SessionDep,
    current_user: CurrentUser,
    start: datetime | None = None,
    end: datetime | None = None,
    doctor_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    status: AppointmentStatus | None = None,
    skip: int = 0,
    limit: int = 500,
) -> Any:
    """Cashiers and superusers see every appointment; doctors only their own."""
    if has_role(current_user, UserRole.CASHIER):
        pass
    elif current_user.role == UserRole.DOCTOR:
        doctor_id = current_user.id
    else:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    statement = select(Appointment)
    if doctor_id:
        statement = statement.where(Appointment.doctor_id == doctor_id)
    if patient_id:
        statement = statement.where(Appointment.patient_id == patient_id)
    if status:
        statement = statement.where(Appointment.status == status)
    if start:
        statement = statement.where(col(Appointment.scheduled_at) >= assume_utc(start))
    if end:
        statement = statement.where(col(Appointment.scheduled_at) < assume_utc(end))

    count = session.exec(select(func.count()).select_from(statement.subquery())).one()
    appts = session.exec(
        statement.order_by(col(Appointment.scheduled_at)).offset(skip).limit(limit)
    ).all()
    return AppointmentsPublic(data=[to_public(session, a) for a in appts], count=count)


@router.post("/", response_model=AppointmentPublic)
def create_appointment(
    *, session: SessionDep, current_user: Booker, appointment_in: AppointmentCreate
) -> Any:
    if not session.get(Patient, appointment_in.patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    get_doctor(session, appointment_in.doctor_id)
    check_no_overlap(
        session,
        appointment_in.doctor_id,
        appointment_in.scheduled_at,
        appointment_in.duration_minutes,
    )
    appt = Appointment.model_validate(
        appointment_in, update={"created_by": current_user.id}
    )
    session.add(appt)
    session.commit()
    session.refresh(appt)
    return to_public(session, appt)


@router.patch("/{id}", response_model=AppointmentPublic)
def update_appointment(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    appointment_in: AppointmentUpdate,
) -> Any:
    """Cashiers can change anything; a doctor can only update the status of
    their own appointments (e.g. mark it completed)."""
    appt = get_visible(session, current_user, id)
    update = appointment_in.model_dump(exclude_unset=True)
    if not has_role(current_user, UserRole.CASHIER) and set(update) - {"status"}:
        raise HTTPException(
            status_code=403, detail="Doctors can only change the appointment status"
        )

    if "doctor_id" in update:
        get_doctor(session, update["doctor_id"])
    if {"doctor_id", "scheduled_at", "duration_minutes", "status"} & set(update):
        merged = appt.model_copy(update=update)
        if merged.status == AppointmentStatus.SCHEDULED:
            check_no_overlap(
                session,
                merged.doctor_id,
                merged.scheduled_at,
                merged.duration_minutes,
                exclude_id=appt.id,
            )

    appt.sqlmodel_update(update)
    appt.updated_at = get_datetime_utc()
    session.add(appt)
    session.commit()
    session.refresh(appt)
    return to_public(session, appt)
