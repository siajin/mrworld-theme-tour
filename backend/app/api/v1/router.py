from fastapi import APIRouter

from app.api.v1 import (
    ai,
    auth,
    bookings,
    catalog,
    me,
    packages,
    staff_bookings,
    staff_customers,
    staff_dashboard,
    staff_inventory,
    staff_notifications,
    staff_packages,
    staff_settings,
    staff_themes,
    staff_upload,
    themes,
)

api_router = APIRouter(prefix="/api/v1")

for r in (
    auth.router,
    me.router,
    catalog.router,
    themes.router,
    packages.router,
    bookings.router,
    ai.router,
    staff_dashboard.router,
    staff_themes.router,
    staff_packages.router,
    staff_inventory.router,
    staff_bookings.router,
    staff_customers.router,
    staff_notifications.router,
    staff_settings.router,
    staff_upload.router,
):
    api_router.include_router(r)
