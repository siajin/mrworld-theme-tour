from pydantic import BaseModel, Field

from app.schemas.common import HotelGrade, MealCode, StyleCode, TransportCode


class StyleOut(BaseModel):
    code: StyleCode
    name: str
    rank: int
    hotel_grade: HotelGrade
    meal_code: MealCode
    description: str


class HotelGradeOut(BaseModel):
    grade: HotelGrade
    label: str
    surcharge: int


class MealOptionOut(BaseModel):
    code: MealCode
    label: str
    surcharge: int
    description: str


class TransportOptionOut(BaseModel):
    code: TransportCode
    label: str
    capacity: int
    surcharge: int


class MealAddonOut(BaseModel):
    id: int
    code: str
    label: str
    price: int
    is_active: bool


class AppSettings(BaseModel):
    min_travelers_default: int
    loyalty_silver_trips: int
    loyalty_silver_rate: float
    loyalty_gold_trips: int
    loyalty_gold_rate: float
    deposit_rate: float


class AppSettingsUpdate(BaseModel):
    min_travelers_default: int | None = Field(default=None, ge=1)
    loyalty_silver_trips: int | None = Field(default=None, ge=0)
    loyalty_silver_rate: float | None = Field(default=None, ge=0, le=1)
    loyalty_gold_trips: int | None = Field(default=None, ge=0)
    loyalty_gold_rate: float | None = Field(default=None, ge=0, le=1)
    deposit_rate: float | None = Field(default=None, ge=0, le=1)


class CatalogOut(BaseModel):
    styles: list[StyleOut]
    hotel_grades: list[HotelGradeOut]
    meal_options: list[MealOptionOut]
    transport_options: list[TransportOptionOut]
    meal_addons: list[MealAddonOut]
    settings: AppSettings
