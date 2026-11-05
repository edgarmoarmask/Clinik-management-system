from fastapi import APIRouter

from app.api.routes import (
    accounting,
    appointments,
    carts,
    clinical_records,
    items,
    login,
    patients,
    payments,
    prescriptions,
    private,
    products,
    users,
    utils,
    pharmacy,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(patients.router)
api_router.include_router(clinical_records.router)
api_router.include_router(prescriptions.router)
api_router.include_router(appointments.router)
api_router.include_router(pharmacy.router)
api_router.include_router(products.router)
api_router.include_router(carts.router)
api_router.include_router(payments.router)
api_router.include_router(accounting.router)


if settings.FASTAPI_ENV == "development":
    api_router.include_router(private.router)
