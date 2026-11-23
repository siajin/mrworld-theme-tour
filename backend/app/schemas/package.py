from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import DepartureStatus, StyleCode
from app.schemas.theme import ThemeBrief


class DepartureIn(BaseModel):
    depart_date: date
    return_date: date
    capacity: int = Field(ge=1)
    status: DepartureStatus = "open"

    @model_validator(mode="after")
    def _check_dates(self) -> "DepartureIn":
        if self.return_date < self.depart_date:
            raise ValueError("귀국일은 출발일 이후여야 해요")
        return self


class DepartureOut(BaseModel):
    id: int
    package_id: int
    depart_date: date
    return_date: date
    capacity: int
    booked: int
    remaining: int
    status: DepartureStatus


class NextDeparture(BaseModel):
    id: int
    depart_date: date
    remaining: int


class PackageCard(BaseModel):
    id: int
    theme: ThemeBrief
    title: str
    subtitle: str
    region: str
    country: str
    nights: int
    days: int
    hero_images: list[str]
    from_price: int
    from_style: StyleCode
    badges: list[str]
    next_departure: NextDeparture | None
    rating: float
    review_count: int
    is_published: bool


class StylePriceOut(BaseModel):
    style_code: StyleCode
    price: int
    available: bool


class ItineraryMeals(BaseModel):
    breakfast: str = ""
    lunch: str = ""
    dinner: str = ""


class ItineraryDay(BaseModel):
    day_no: int = Field(ge=1)
    title: str = ""
    places: list[str] = []
    meals: ItineraryMeals = ItineraryMeals()
    lodging: str = ""
    description: str = ""


class PackageOut(PackageCard):
    summary: str
    includes: list[str]
    excludes: list[str]
    notes: str
    highlights: list[str]
    style_prices: list[StylePriceOut]
    itinerary: list[ItineraryDay]
    departures: list[DepartureOut]
    created_at: datetime
    updated_at: datetime


class StylePriceIn(BaseModel):
    style_code: StyleCode
    price: int = Field(ge=0)


class PackageIn(BaseModel):
    theme_id: int
    title: str = Field(min_length=1, max_length=200)
    subtitle: str = ""
    region: str = ""
    country: str = ""
    nights: int = Field(ge=0)
    days: int = Field(ge=1)
    hero_images: list[str] = []
    summary: str = ""
    highlights: list[str] = []
    includes: list[str] = []
    excludes: list[str] = []
    notes: str = ""
    badges: list[str] = []
    style_prices: list[StylePriceIn] = []
    itinerary: list[ItineraryDay] = []
    is_published: bool = False
    rating: float = Field(default=4.7, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)


class PublishIn(BaseModel):
    is_published: bool


class FeaturedOut(BaseModel):
    popular: list[PackageCard]
    closing_soon: list[PackageCard]
    by_theme: dict[str, list[PackageCard]]
