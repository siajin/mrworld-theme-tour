from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin

CANCELLABLE_STATUSES = ("pending", "gathering", "confirmed")
TRAVELER_EDITABLE_STATUSES = ("pending", "gathering")  # 인원 변경이 가능한 상태


class Booking(Base, TimestampMixin):
    """예약 1건 = 대표자 + 동행. 확정 여부는 이 한 건의 travelers_count 로만 판단한다.
    상태 기계의 전이 가능 여부(취소·인원 변경)와 부족 인원 계산은 이 엔티티가 안다."""

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)  # MW-2026-000123
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"), nullable=False, index=True)
    departure_id: Mapped[int] = mapped_column(ForeignKey("departures.id"), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    style_code: Mapped[str] = mapped_column(String(20), nullable=False)
    hotel_grade: Mapped[int] = mapped_column(Integer, nullable=False)
    meal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    transport_code: Mapped[str] = mapped_column(String(30), nullable=False)
    travelers_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # 마지막으로 계산된 견적 스냅샷 (Quote 스키마와 동일한 dict)
    quote: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deposit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    invite_code: Mapped[str | None] = mapped_column(String(8), unique=True, nullable=True, index=True)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    memo: Mapped[str] = mapped_column(Text, default="", nullable=False)

    customer: Mapped["User"] = relationship()  # noqa: F821
    package: Mapped["Package"] = relationship()  # noqa: F821
    departure: Mapped["Departure"] = relationship(back_populates="bookings")  # noqa: F821
    addons: Mapped[list["BookingAddon"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingAddon.id"
    )
    travelers: Mapped[list["BookingTraveler"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingTraveler.id"
    )

    @property
    def included_perks(self) -> list[dict]:
        """새 예약은 저장된 기본 제공 구성, 과거 예약은 현재 테마 구성을 반환한다."""
        return self.quote.get("_theme_perks", self.package.theme.perk_snapshot())

    @property
    def needed_more(self) -> int:
        """확정까지 더 모아야 하는 인원 (테마 최소 인원 - 현재 인원, 0 이하면 0)."""
        return max(0, self.package.theme.min_travelers - self.travelers_count)

    @property
    def is_cancellable(self) -> bool:
        """pending·gathering·confirmed 만 취소할 수 있다."""
        return self.status in CANCELLABLE_STATUSES

    @property
    def can_change_travelers(self) -> bool:
        """확정 전(pending·gathering)에만 동행을 추가·삭제할 수 있다."""
        return self.status in TRAVELER_EDITABLE_STATUSES

    def participant_user_ids(self) -> list[int]:
        """대표자 + 회원 동행의 user_id (중복 제거, 순서 유지)."""
        ids = [self.user_id] + [t.user_id for t in self.travelers if t.user_id is not None]
        return list(dict.fromkeys(ids))


class BookingAddon(Base):
    __tablename__ = "booking_addons"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_addon_id: Mapped[int] = mapped_column(ForeignKey("meal_addons.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False)

    booking: Mapped[Booking] = relationship(back_populates="addons")


class BookingTraveler(Base):
    __tablename__ = "booking_travelers"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), default="", nullable=False)
    birth: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_representative: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    joined_via_code: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    booking: Mapped[Booking] = relationship(back_populates="travelers")
