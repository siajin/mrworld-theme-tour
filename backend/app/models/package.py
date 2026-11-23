from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, now
from app.services.pricing import STYLES


class Package(Base):
    """여행 상품. 스타일별 1인 가격표를 가지며 '최저가' 규칙(테마 허용 스타일 중 최저)을 안다."""

    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    theme_id: Mapped[int] = mapped_column(ForeignKey("themes.id"), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    region: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    nights: Mapped[int] = mapped_column(Integer, nullable=False)
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    hero_images: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    highlights: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    includes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    excludes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    badges: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=4.7, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now, nullable=False)

    theme: Mapped["Theme"] = relationship(back_populates="packages")  # noqa: F821
    style_prices: Mapped[list["PackageStylePrice"]] = relationship(
        back_populates="package", cascade="all, delete-orphan", order_by="PackageStylePrice.id"
    )
    itinerary: Mapped[list["PackageItinerary"]] = relationship(
        back_populates="package", cascade="all, delete-orphan", order_by="PackageItinerary.day_no"
    )
    departures: Mapped[list["Departure"]] = relationship(
        back_populates="package", cascade="all, delete-orphan", order_by="Departure.depart_date"
    )

    def set_style_prices(self, prices: dict[str, int]) -> None:
        """스타일 가격을 제자리에서 갱신한다 (컬렉션 통째 교체는 (package_id, style_code) 유니크 제약과 충돌)."""
        existing = {sp.style_code: sp for sp in self.style_prices}
        for code, row in existing.items():
            if code not in prices:
                self.style_prices.remove(row)
        for code, price in prices.items():
            if code in existing:
                existing[code].price = price
            else:
                self.style_prices.append(PackageStylePrice(style_code=code, price=price))

    def price_for(self, style_code: str) -> int | None:
        """해당 스타일의 1인 가격. 가격표에 없는 스타일이면 None."""
        return next((sp.price for sp in self.style_prices if sp.style_code == style_code), None)

    def from_price(self) -> tuple[int, str]:
        """테마가 허용하는 스타일 중 최저 1인 가격과 그 스타일 코드. 후보가 없으면 (0, 허용 최저 스타일)."""
        candidates = [
            (sp.price, STYLES[sp.style_code].rank, sp.style_code)
            for sp in self.style_prices
            if sp.style_code in STYLES and self.theme.allows_style(STYLES[sp.style_code].rank)
        ]
        if not candidates:
            return 0, "grand" if self.theme.min_style_rank >= 2 else "classic"
        price, _rank, code = min(candidates)
        return price, code


class PackageStylePrice(Base):
    """스타일별 1인 가격. 테마가 허용하지 않는 스타일(허니문 classic 등)은 행이 없다."""

    __tablename__ = "package_style_prices"
    __table_args__ = (UniqueConstraint("package_id", "style_code", name="uq_package_style"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id", ondelete="CASCADE"), nullable=False, index=True)
    style_code: Mapped[str] = mapped_column(String(20), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)

    package: Mapped[Package] = relationship(back_populates="style_prices")


class PackageItinerary(Base):
    __tablename__ = "package_itinerary"

    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id", ondelete="CASCADE"), nullable=False, index=True)
    day_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    places: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    breakfast: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    lunch: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    dinner: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    lodging: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    package: Mapped[Package] = relationship(back_populates="itinerary")


class Departure(Base):
    """출발일정. 정원 대비 예약 인원(booked/remaining)과 예약 가능 여부 규칙을 가진다."""

    __tablename__ = "departures"

    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id", ondelete="CASCADE"), nullable=False, index=True)
    depart_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)  # open | closed | departed

    package: Mapped[Package] = relationship(back_populates="departures")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="departure")  # noqa: F821

    @property
    def booked(self) -> int:
        """예약 인원 = 취소되지 않은 예약들의 travelers_count 합."""
        return sum(b.travelers_count for b in self.bookings if b.status != "cancelled")

    @property
    def remaining(self) -> int:
        """잔여 인원 (음수가 되지 않게 0 으로 자른다)."""
        return max(0, self.capacity - self.booked)

    def is_bookable(self, today: date) -> bool:
        """예약을 받을 수 있는 일정인가: open 상태이고 아직 출발 전."""
        return self.status == "open" and self.depart_date >= today
