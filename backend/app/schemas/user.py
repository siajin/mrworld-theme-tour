from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import LoyaltyTier, Role


class Loyalty(BaseModel):
    tier: LoyaltyTier
    completed_trips: int
    rate: float
    next_tier_trips: int | None


class UserOut(BaseModel):
    id: int
    email: str
    role: Role
    name: str
    phone: str
    address: str
    created_at: datetime
    loyalty: Loyalty | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=255)


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(default="", max_length=50)
    address: str = Field(default="", max_length=255)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthOut(TokenPair):
    user: UserOut


class CustomerRow(UserOut):
    bookings_count: int
    last_trip: str | None
