from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import UserCreate, UserRole
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email, random_lower_string

API = settings.API_V1_STR


def headers_for_role(
    client: TestClient, db: Session, role: UserRole | None
) -> dict[str, str]:
    email, password = random_email(), random_lower_string()
    crud.create_user(
        session=db, user_create=UserCreate(email=email, password=password, role=role)
    )
    return user_authentication_headers(client=client, email=email, password=password)


def create_patient(client: TestClient, headers: dict[str, str]) -> str:
    r = client.post(
        f"{API}/patients/",
        headers=headers,
        json={"first_name": "Ana", "last_name": "Diaz", "age": 40},
    )
    assert r.status_code == 200
    return r.json()["id"]


def record_body(patient_id: str, **extra: object) -> dict:
    return {
        "patient_id": patient_id,
        "emr_number": "EMR-1",
        "visit_date": "2026-10-20T10:00:00",
        "physician_name": "Dr. Who",
    } | extra


def test_superuser_can_set_user_role(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    r = client.post(
        f"{API}/users/",
        headers=superuser_token_headers,
        json={
            "email": random_email(),
            "password": random_lower_string(),
            "role": "cashier",
        },
    )
    assert r.status_code == 200
    assert r.json()["role"] == "cashier"
    r = client.patch(
        f"{API}/users/{r.json()['id']}",
        headers=superuser_token_headers,
        json={"role": "doctor"},
    )
    assert r.json()["role"] == "doctor"


def test_only_doctors_can_diagnose(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    patient_id = create_patient(client, superuser_token_headers)
    doctor = headers_for_role(client, db, UserRole.DOCTOR)
    cashier = headers_for_role(client, db, UserRole.CASHIER)

    r = client.post(
        f"{API}/clinical-records/",
        headers=cashier,
        json=record_body(patient_id, diagnosis="Flu"),
    )
    assert r.status_code == 403

    # anyone may log a visit without a diagnosis
    r = client.post(
        f"{API}/clinical-records/", headers=cashier, json=record_body(patient_id)
    )
    assert r.status_code == 200
    record_id = r.json()["id"]
    r = client.put(
        f"{API}/clinical-records/{record_id}",
        headers=cashier,
        json={"diagnosis": "Flu"},
    )
    assert r.status_code == 403

    r = client.post(
        f"{API}/clinical-records/",
        headers=doctor,
        json=record_body(patient_id, diagnosis="Hypertension"),
    )
    assert r.status_code == 200

    patient = client.get(f"{API}/patients/{patient_id}", headers=doctor).json()
    assert patient["recent_diagnosis"] == "Hypertension"
    assert patient["last_visit"] == "2026-10-20"


def test_cashier_accounting_access(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    cashier = headers_for_role(client, db, UserRole.CASHIER)
    doctor = headers_for_role(client, db, UserRole.DOCTOR)
    body = {"amount": "5.00", "method": "cash", "kind": "expense", "account_code": "6070"}

    r = client.post(f"{API}/payments", headers=cashier, json=body)
    assert r.status_code == 201
    payment_id = r.json()["id"]
    r = client.post(f"{API}/payments", headers=doctor, json=body)
    assert r.status_code == 403

    # cashiers see everyone's payments, other users only their own
    r = client.get(f"{API}/payments/{payment_id}", headers=superuser_token_headers)
    assert r.status_code == 200
    ids = [p["id"] for p in client.get(f"{API}/payments", headers=doctor).json()["data"]]
    assert payment_id not in ids


def test_only_doctors_can_prescribe(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    patient_id = create_patient(client, superuser_token_headers)
    body = {
        "patient_id": patient_id,
        "medication": "Amoxicillin",
        "dosage": "250 mg",
        "frequency": "Three times daily",
        "prescribed_date": "2026-11-02",
        "prescribed_by": "Someone Else",  # ignored: the server sets it
    }
    cashier = headers_for_role(client, db, UserRole.CASHIER)
    assert client.post(f"{API}/prescriptions/", headers=cashier, json=body).status_code == 403

    email, password = random_email(), random_lower_string()
    crud.create_user(
        session=db,
        user_create=UserCreate(
            email=email, password=password, full_name="Dr. Aisha", role=UserRole.DOCTOR
        ),
    )
    doctor = user_authentication_headers(client=client, email=email, password=password)
    r = client.post(f"{API}/prescriptions/", headers=doctor, json=body)
    assert r.status_code == 200
    assert r.json()["prescribed_by"] == "Dr. Aisha"

    # the prescriber can't be changed afterwards either
    r = client.put(
        f"{API}/prescriptions/{r.json()['id']}",
        headers=doctor,
        json={"prescribed_by": "Forged"},
    )
    assert r.json()["prescribed_by"] == "Dr. Aisha"

    # without a full name, the email is used
    no_name = headers_for_role(client, db, UserRole.DOCTOR)
    r = client.post(f"{API}/prescriptions/", headers=no_name, json=body)
    assert "@" in r.json()["prescribed_by"]
