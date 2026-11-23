from fastapi import APIRouter
from sqlalchemy import select

from app.core.deps import DbDep
from app.models import MealAddon
from app.schemas.catalog import CatalogOut, MealAddonOut
from app.services.app_settings import SettingsStore
from app.services.pricing import PricingEngine

router = APIRouter(tags=["catalog"])


@router.get("/catalog", response_model=CatalogOut)
def get_catalog(db: DbDep) -> CatalogOut:
    addons = db.scalars(select(MealAddon).order_by(MealAddon.id)).all()
    catalog = PricingEngine().catalog()
    return CatalogOut(
        styles=catalog.styles,
        hotel_grades=catalog.hotel_grades,
        meal_options=catalog.meal_options,
        transport_options=catalog.transport_options,
        meal_addons=[MealAddonOut(id=a.id, code=a.code, label=a.label, price=a.price, is_active=a.is_active) for a in addons],
        settings=SettingsStore(db).load(),
    )
