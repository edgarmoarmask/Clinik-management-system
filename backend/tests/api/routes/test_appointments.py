from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import UserCreate, UserRole
from tests.api.routes.test_roles import create_patient, headers_for_role
from tests.utils.user import user_authentication_headers
from tests.utils.utils import random_email, random_lower_string

API = f"{settings.API_V1_STR}/appointments"


def create_doctor(client: TestClient, db: Session) -> tuple[str, dict[str, str]]:
    email, password = random_email(), random_lower_string()
    doctor = crud.create_user(
        session=db,
        user_create=UserCreate(
            email=email, password=password, full_name="Dr. Tan", role=UserRole.DOCTOR
        ),
    )
    headers = user_authentication_headers(client=client, email=email, password=password)
    return str(doctor.id), headers


def test_cashier_books_and_doctor_sees_own(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    cashier = headers_for_role(client, db, UserRole.CASHIER)
    patient_id = create_patient(client, superuser_token_headers)
    doctor_id, doctor = create_doctor(client, db)
    other_id, other_doctor = create_doctor(client, db)

    doctors = client.get(f"{API}/doctors", headers=cashier).json()
    assert doctor_id in [d["id"] for d in doctors]

    r = client.post(
        f"{API}/",
        headers=cashier,
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "scheduled_at": "2026-12-01T09:00:00+08:00",
            "duration_minutes": 30,
            "reason": "Back pain",
        },
    )
    assert r.status_code == 200, r.text
    appt = r.json()
    assert appt["doctor_name"] == "Dr. Tan"
    assert appt["patient_name"] == "Ana Diaz"
    assert appt["status"] == "Scheduled"

    mine = client.get(f"{API}/", headers=doctor).json()["data"]
    assert [a["id"] for a in mine] == [appt["id"]]
    # a doctor can't see another doctor's appointments, even by asking
    theirs = client.get(
        f"{API}/", headers=other_doctor, params={"doctor_id": doctor_id}
    ).json()["data"]
    assert appt["id"] not in [a["id"] for a in theirs]

    # the doctor can mark it completed but not reschedule it
    r = client.patch(
        f"{API}/{appt['id']}",
        headers=doctor,
        json={"scheduled_at": "2026-12-02T09:00:00Z"},
    )
    assert r.status_code == 403
    r = client.patch(
        f"{API}/{appt['id']}", headers=other_doctor, json={"status": "Completed"}
    )
    assert r.status_code == 403
    r = client.patch(
        f"{API}/{appt['id']}", headers=doctor, json={"status": "Completed"}
    )
    assert r.json()["status"] == "Completed"
    assert other_id != doctor_id


def test_booking_rules(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    cashier = headers_for_role(client, db, UserRole.CASHIER)
    plain_doctor = headers_for_role(client, db, UserRole.DOCTOR)
    patient_id = create_patient(client, superuser_token_headers)
    doctor_id, _ = create_doctor(client, db)
    body = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "scheduled_at": "2026-12-03T10:00:00Z",
        "duration_minutes": 60,
    }
    first = client.post(f"{API}/", headers=cashier, json=body)
    assert first.status_code == 200

    # overlapping slot for the same doctor
    clash = body | {"scheduled_at": "2026-12-03T10:30:00Z"}
    assert client.post(f"{API}/", headers=cashier, json=clash).status_code == 409
    # back-to-back is fine
    after = body | {"scheduled_at": "2026-12-03T11:00:00Z"}
    assert client.post(f"{API}/", headers=cashier, json=after).status_code == 200
    # once cancelled, the slot frees up
    client.patch(
        f"{API}/{first.json()['id']}", headers=cashier, json={"status": "Cancelled"}
    )
    freed = body | {"duration_minutes": 30}  # 10:00-10:30, before the 11:00 one
    assert client.post(f"{API}/", headers=cashier, json=freed).status_code == 200

    # only doctors can be booked, and only cashiers/admins can book
    cashier_id = client.get(f"{settings.API_V1_STR}/users/me", headers=cashier).json()[
        "id"
    ]
    r = client.post(f"{API}/", headers=cashier, json=body | {"doctor_id": cashier_id})
    assert r.status_code == 400
    assert client.post(f"{API}/", headers=plain_doctor, json=body).status_code == 403

    nobody = headers_for_role(client, db, None)
    assert client.get(f"{API}/", headers=nobody).status_code == 403


def test_patient_physician_and_vitals(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    cashier = headers_for_role(client, db, UserRole.CASHIER)
    doctor_id, _ = create_doctor(client, db)
    patients = f"{settings.API_V1_STR}/patients/"
    body = {"first_name": "Siti", "last_name": "Aminah", "age": 40}

    r = client.post(
        patients,
        headers=cashier,
        json={
            **body,
            "physician_id": doctor_id,
            "weight_kg": 62.5,
            "height_cm": 158,
            "blood_pressure": "120/80",
        },
    )
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["physician_id"] == doctor_id
    assert p["physician_name"] == "Dr. Tan"
    assert (p["weight_kg"], p["height_cm"], p["blood_pressure"]) == (
        62.5,
        158,
        "120/80",
    )

    # only doctors can be a patient's physician
    cashier_id = client.get(f"{settings.API_V1_STR}/users/me", headers=cashier).json()[
        "id"
    ]
    r = client.post(
        patients, headers=cashier, json={**body, "physician_id": cashier_id}
    )
    assert r.status_code == 400
    r = client.post(patients, headers=cashier, json={**body, "blood_pressure": "high"})
    assert r.status_code == 422


def test_only_superuser_edits_and_deletes_patients(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    cashier = headers_for_role(client, db, UserRole.CASHIER)
    doctor_id, doctor = create_doctor(client, db)
    pid = create_patient(client, superuser_token_headers)
    url = f"{settings.API_V1_STR}/patients/{pid}"

    for headers in (cashier, doctor):
        assert client.put(url, headers=headers, json={"age": 9}).status_code == 403
        assert client.delete(url, headers=headers).status_code == 403

    r = client.put(
        url,
        headers=superuser_token_headers,
        json={"physician_id": doctor_id, "weight_kg": 80},
    )
    assert r.status_code == 200, r.text
    assert (r.json()["physician_name"], r.json()["weight_kg"]) == ("Dr. Tan", 80)
    r = client.put(url, headers=superuser_token_headers, json={"physician_id": None})
    assert r.json()["physician_name"] is None

    assert client.delete(url, headers=superuser_token_headers).status_code == 200
    assert client.get(url, headers=superuser_token_headers).status_code == 404
