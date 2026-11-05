import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Pharmacy,
    PharmacyCreate,
    PharmacyPublic,
    PharmaciesPublic,
    PharmacyUpdate,
    get_datetime_utc,
)

router = APIRouter(prefix="/pharmacies", tags=["pharmacies"])


@router.get("/", response_model=PharmaciesPublic)
def read_pharmacies(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    is_active: bool | None = None,
) -> Any:
    """
    Retrieve pharmacies. `q` matches name, city or license number.
    """
    statement = select(Pharmacy)
    if q:
        like = f"%{q}%"
        statement = statement.where(
            or_(
                col(Pharmacy.name).ilike(like),
                col(Pharmacy.city).ilike(like),
                col(Pharmacy.license_number).ilike(like),
            )
        )
    if is_active is not None:
        statement = statement.where(Pharmacy.is_active == is_active)

    count = session.exec(select(func.count()).select_from(statement.subquery())).one()
    pharmacies = session.exec(
        statement.order_by(col(Pharmacy.name)).offset(skip).limit(limit)
    ).all()
    return PharmaciesPublic(
        data=[PharmacyPublic.model_validate(p) for p in pharmacies], count=count
    )


@router.get("/{id}", response_model=PharmacyPublic)
def read_pharmacy(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    pharmacy = session.get(Pharmacy, id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return pharmacy


@router.post("/", response_model=PharmacyPublic)
def create_pharmacy(
    *, session: SessionDep, current_user: CurrentUser, pharmacy_in: PharmacyCreate
) -> Any:
    pharmacy = Pharmacy.model_validate(pharmacy_in)
    session.add(pharmacy)
    session.commit()
    session.refresh(pharmacy)
    return pharmacy


@router.put("/{id}", response_model=PharmacyPublic)
def update_pharmacy(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    pharmacy_in: PharmacyUpdate,
) -> Any:
    pharmacy = session.get(Pharmacy, id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    pharmacy.sqlmodel_update(pharmacy_in.model_dump(exclude_unset=True))
    pharmacy.updated_at = get_datetime_utc()
    session.add(pharmacy)
    session.commit()
    session.refresh(pharmacy)
    return pharmacy


@router.delete("/{id}")
def delete_pharmacy(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    pharmacy = session.get(Pharmacy, id)
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    session.delete(pharmacy)
    session.commit()
    return Message(message="Pharmacy deleted successfully")
