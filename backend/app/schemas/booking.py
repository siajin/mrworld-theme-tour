from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import BookingStatus, HotelGrade, MealCode, StyleCode, TransportCode
from app.schemas.package import DepartureOut, PackageCard
from app.schemas.theme import ThemePerkOut


class AddonIn(BaseModel):
    meal_addon_id: int
    qty: int = Field(ge=1)


class QuoteRequest(BaseModel):
    package_id: int
    departure_id: int
    style_code: StyleCode
    hotel_grade: HotelGrade | None = None
    meal_code: MealCode | None = None
    transport_code: TransportCode | None = None
    addons: list[AddonIn] = []
    travelers_count: int = Field(ge=1)


class QuoteResolved(BaseModel):
    hotel_grade: HotelGrade
    meal_code: MealCode
    transport_code: TransportCode


class QuoteLine(BaseModel):
    label: str
    amount: int


class Quote(BaseModel):
    per_person: int
    style_price: int
    hotel_delta: int
    meal_delta: int
    subtotal: int
    transport_total: int
    addons_total: int
    discount: int
    discount_rate: float
    total: int
    deposit: int
    travelers_count: int
    resolved: QuoteResolved
    lines: list[QuoteLine]


class TravelerIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(default="", max_length=50)
    birth: str | None = None
    is_representative: bool = False


class TravelerOut(TravelerIn):
    id: int
    user_id: int | None
    is_representative: bool
    joined_via_code: bool


class BookingCreate(QuoteRequest):
    travelers: list[TravelerIn]
    memo: str = ""

    @model_validator(mode="after")
    def _check_travelers(self) -> "BookingCreate":
        if len(self.travelers) != self.travelers_count:
            raise ValueError("여행자 명단 수와 인원 수가 일치해야 해요")
        if sum(1 for t in self.travelers if t.is_representative) != 1:
            raise ValueError("대표자는 한 명이어야 해요")
        return self


class BookingCustomer(BaseModel):
    id: int
    name: str
    phone: str
    email: str


class BookingTheme(BaseModel):
    slug: str
    name: str
    min_travelers: int
    perks: list[ThemePerkOut] = []


class BookingAddonOut(BaseModel):
    meal_addon_id: int
    label: str
    qty: int
    unit_price: int


class BookingOut(BaseModel):
    id: int
    code: str
    status: BookingStatus
    customer: BookingCustomer
    package: PackageCard
    departure: DepartureOut
    theme: BookingTheme
    style_code: StyleCode
    hotel_grade: HotelGrade
    meal_code: MealCode
    transport_code: TransportCode
    addons: list[BookingAddonOut]
    travelers_count: int
    travelers: list[TravelerOut]
    quote: Quote
    invite_code: str | None
    needed_more: int
    paid_at: datetime | None
    confirmed_at: datetime | None
    created_at: datetime
    memo: str


class PayIn(BaseModel):
    method: Literal["card", "transfer"]


class JoinIn(BaseModel):
    invite_code: str = Field(min_length=1, max_length=8)


class InvitePreview(BaseModel):
    booking_id: int
    package_title: str
    theme_name: str
    depart_date: date
    representative_name: str
    travelers_count: int
    min_travelers: int
    needed_more: int


class TripOut(BaseModel):
    booking_id: int
    code: str
    package_title: str
    theme_name: str
    region: str
    depart_date: date
    return_date: date
    nights: int
    days: int
    style_code: StyleCode
    style_name: str
    total: int
    status: BookingStatus
    hero_image: str
