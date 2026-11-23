from fastapi import APIRouter

from app.core.deps import DbDep, StaffUser
from app.schemas.catalog import AppSettings, AppSettingsUpdate
from app.services.app_settings import SettingsStore

router = APIRouter(prefix="/staff/settings", tags=["staff:settings"])


@router.get("", response_model=AppSettings)
def get_settings_(db: DbDep, _: StaffUser) -> AppSettings:
    return SettingsStore(db).load()


@router.put("", response_model=AppSettings)
def put_settings(payload: AppSettingsUpdate, db: DbDep, _: StaffUser) -> AppSettings:
    return SettingsStore(db).update(payload)
