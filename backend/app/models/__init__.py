from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now() -> datetime:
    """서버 로컬 시각 (naive). SQLite/Postgres 공통으로 사용."""
    return datetime.now().replace(microsecond=0)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, nullable=False)


from app.models.booking import Booking, BookingAddon, BookingTraveler  # noqa: E402
from app.models.inventory import InventoryItem, InventoryMove  # noqa: E402
from app.models.meal_addon import MealAddon  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.package import Departure, Package, PackageItinerary, PackageStylePrice  # noqa: E402
from app.models.setting import Setting  # noqa: E402
from app.models.theme import Theme, ThemePerk  # noqa: E402
from app.models.user import User  # noqa: E402

__all__ = [
    "Base",
    "now",
    "Booking",
    "BookingAddon",
    "BookingTraveler",
    "Departure",
    "InventoryItem",
    "InventoryMove",
    "MealAddon",
    "Notification",
    "Package",
    "PackageItinerary",
    "PackageStylePrice",
    "Setting",
    "Theme",
    "ThemePerk",
    "User",
]
