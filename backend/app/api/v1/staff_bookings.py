from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.core.deps import DbDep, StaffUser
from app.models import Booking, Package, User
from app.schemas.booking import BookingOut
from app.schemas.common import BookingStatus
from app.services.booking import BookingService
from app.services.presenters import booking_out, bookings_out

router = APIRouter(prefix="/staff/bookings", tags=["staff:bookings"])


@router.get("", response_model=list[BookingOut])
def list_bookings(
    db: DbDep,
    _: StaffUser,
    status: BookingStatus | None = Query(default=None),
    departure_id: int | None = None,
    package_id: int | None = None,
    q: str | None = None,
) -> list[BookingOut]:
    stmt = select(Booking).join(User, Booking.user_id == User.id).join(Package, Booking.package_id == Package.id)
    if status:
        stmt = stmt.where(Booking.status == status)
    if departure_id is not None:
        stmt = stmt.where(Booking.departure_id == departure_id)
    if package_id is not None:
        stmt = stmt.where(Booking.package_id == package_id)
    if q:
        stmt = stmt.where(or_(Booking.code.contains(q), User.name.contains(q), User.email.contains(q), User.phone.contains(q), Package.title.contains(q)))
    return bookings_out(db, list(db.scalars(stmt.order_by(Booking.created_at.desc(), Booking.id.desc())).all()))


@router.post("/{booking_id}/confirm", response_model=BookingOut)
def confirm(booking_id: int, db: DbDep, _: StaffUser) -> BookingOut:
    service = BookingService(db)
    return booking_out(db, service.confirm_by_staff(service.get_or_404(booking_id)))


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: int, db: DbDep, _: StaffUser) -> BookingOut:
    service = BookingService(db)
    return booking_out(db, service.cancel(service.get_or_404(booking_id)))


@router.post("/{booking_id}/complete", response_model=BookingOut)
def complete(booking_id: int, db: DbDep, _: StaffUser) -> BookingOut:
    service = BookingService(db)
    return booking_out(db, service.complete(service.get_or_404(booking_id)))
