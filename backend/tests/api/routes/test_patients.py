import uuid

from fastapi.testclient import TestClient

from app.core.config import settings

BASE = f"{settings.API_V1_STR}/patients/"


def _create_patient(client: TestClient, headers: dict[str, str], **extra) -> dict:
    data = {
        "first_name": "Aisha",
        "last_name": "Rahman",
        "age": 42,
        "gender": "F",
        "chronic_conditions": ["Osteoarthritis"],
        **extra,
    }
    response = client.post(BASE, headers=headers, json=data)
    assert response.status_code == 200, response.text
    return response.json()


def test_patients_require_auth(client: TestClient) -> None:
    assert client.get(BASE).status_code == 401


def test_patient_crud_and_children(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    patient = _create_patient(client, superuser_token_headers)
    pid = patient["id"]
    assert patient["chronic_conditions"] == ["Osteoarthritis"]

    # update
    r = client.put(
        f"{BASE}{pid}",
        headers=superuser_token_headers,
        json={"has_alert": True, "alert_message": "Penicillin allergy"},
    )
    assert r.status_code == 200
    assert r.json()["has_alert"] is True

    # search + filter
    r = client.get(BASE, headers=superuser_token_headers, params={"q": "rahman"})
    assert r.json()["count"] >= 1
    r = client.get(BASE, headers=superuser_token_headers, params={"has_alert": True})
    assert any(p["id"] == pid for p in r.json()["data"])

    # clinical record + prescription
    rec = client.post(
        f"{settings.API_V1_STR}/clinical-records/",
        headers=superuser_token_headers,
        json={
            "patient_id": pid,
            "emr_number": "EMR-0001",
            "visit_date": "2026-10-01T09:30:00",
            "physician_name": "Dr. Lim",
            "visit_type": "Consultation",
        },
    )
    assert rec.status_code == 200, rec.text
    rx = client.post(
        f"{settings.API_V1_STR}/prescriptions/",
        headers=superuser_token_headers,
        json={
            "patient_id": pid,
            "medication": "Paracetamol",
            "dosage": "500mg",
            "frequency": "Twice daily",
            "prescribed_date": "2026-10-01",
        },
    )
    assert rx.status_code == 200, rx.text
    assert rx.json()["status"] == "Active"
    assert rx.json()["prescribed_by"]  # filled in from the logged-in user

    r = client.get(
        f"{settings.API_V1_STR}/prescriptions/",
        headers=superuser_token_headers,
        params={"patient_id": pid, "status": "Active"},
    )
    assert r.json()["count"] == 1

    # deleting the patient cascades
    assert client.delete(f"{BASE}{pid}", headers=superuser_token_headers).status_code == 200
    r = client.get(
        f"{settings.API_V1_STR}/clinical-records/{rec.json()['id']}",
        headers=superuser_token_headers,
    )
    assert r.status_code == 404


def test_invalid_enum_and_missing_patient(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        BASE,
        headers=superuser_token_headers,
        json={"first_name": "A", "last_name": "B", "age": 1, "gender": "X"},
    )
    assert r.status_code == 422
    r = client.post(
        f"{settings.API_V1_STR}/prescriptions/",
        headers=superuser_token_headers,
        json={
            "patient_id": str(uuid.uuid4()),
            "medication": "m",
            "dosage": "d",
            "frequency": "f",
            "prescribed_date": "2026-10-01",
        },
    )
    assert r.status_code == 404
