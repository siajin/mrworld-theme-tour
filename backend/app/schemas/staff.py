from pydantic import BaseModel

from app.schemas.booking import BookingOut
from app.schemas.inventory import InventoryItemOut
from app.schemas.notification import NotificationOut
from app.schemas.package import DepartureOut
from app.schemas.user import UserOut


class UpcomingDeparture(BaseModel):
    departure: DepartureOut
    package_title: str
    theme_name: str
    bookings: int


class StaffDashboard(BaseModel):
    today_bookings: int
    gathering_bookings: int
    confirmed_this_week: int
    revenue_this_month: int
    upcoming_departures: list[UpcomingDeparture]
    low_stock_items: list[InventoryItemOut]
    recent_notifications: list[NotificationOut]
    recent_bookings: list[BookingOut]


class CustomerDetail(BaseModel):
    user: UserOut
    bookings: list[BookingOut]


class UploadOut(BaseModel):
    url: str
