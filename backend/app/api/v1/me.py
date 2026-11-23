from fastapi import APIRouter, Query
from sqlalchemy import Select, or_, select

from app.core.deps import CurrentUser, DbDep
from app.models import Booking, BookingTraveler, Departure, User
from app.schemas.booking import BookingOut, TripOut
from app.schemas.common import BookingStatus
from app.schemas.user import UserOut, UserUpdate
from app.services.presenters import bookings_out, trip_out, user_out

router = APIRouter(prefix="/me", tags=["me"])


def my_bookings_query(user: User) -> Select:
    """대표자로 예약했거나 회원 동행으로 포함된 예약."""
    joined_ids = select(BookingTraveler.booking_id).where(BookingTraveler.user_id == user.id)
    return select(Booking).where(or_(Booking.user_id == user.id, Booking.id.in_(joined_ids)))


@router.get("", response_model=UserOut)
def read_me(user: CurrentUser, db: DbDep) -> UserOut:
    return user_out(user, db)


@router.put("", response_model=UserOut)
def update_me(payload: UserUpdate, user: CurrentUser, db: DbDep) -> UserOut:
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user_out(user, db)


@router.get("/trips", response_model=list[TripOut])
def my_trips(user: CurrentUser, db: DbDep) -> list[TripOut]:
    stmt = (
        my_bookings_query(user)
        .join(Departure, Booking.departure_id == Departure.id)
        .where(Booking.status != "cancelled")
        .order_by(Departure.depart_date.desc(), Booking.id.desc())
    )
    return [trip_out(b) for b in db.scalars(stmt).all()]


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(user: CurrentUser, db: DbDep, status: BookingStatus | None = Query(default=None)) -> list[BookingOut]:
    stmt = my_bookings_query(user).order_by(Booking.created_at.desc(), Booking.id.desc())
    if status:
        stmt = stmt.where(Booking.status == status)
    return bookings_out(db, list(db.scalars(stmt).all()))
