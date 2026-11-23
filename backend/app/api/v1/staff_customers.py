from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select

from app.core.deps import DbDep, StaffUser
from app.models import Booking, Departure, User
from app.schemas.staff import CustomerDetail
from app.schemas.user import CustomerRow
from app.services.presenters import bookings_out, user_out

router = APIRouter(prefix="/staff/customers", tags=["staff:customers"])


@router.get("", response_model=list[CustomerRow])
def list_customers(db: DbDep, _: StaffUser, q: str | None = None) -> list[CustomerRow]:
    stmt = select(User).where(User.role == "customer")
    if q:
        stmt = stmt.where(or_(User.name.contains(q), User.email.contains(q), User.phone.contains(q)))
    users = db.scalars(stmt.order_by(User.id)).all()
    ids = [u.id for u in users]
    stats: dict[int, tuple[int, str | None]] = {}
    if ids:
        rows = db.execute(
            select(Booking.user_id, func.count(Booking.id), func.max(Departure.depart_date))
            .join(Departure, Booking.departure_id == Departure.id)
            .where(Booking.user_id.in_(ids), Booking.status != "cancelled")
            .group_by(Booking.user_id)
        ).all()
        stats = {uid: (int(cnt), str(last) if last else None) for uid, cnt, last in rows}
    result: list[CustomerRow] = []
    for u in users:
        count, last = stats.get(u.id, (0, None))
        result.append(CustomerRow(**user_out(u, db).model_dump(), bookings_count=count, last_trip=last))
    return result


@router.get("/{user_id}", response_model=CustomerDetail)
def get_customer(user_id: int, db: DbDep, _: StaffUser) -> CustomerDetail:
    user = db.get(User, user_id)
    if user is None or user.role != "customer":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "고객을 찾을 수 없어요")
    bookings = db.scalars(select(Booking).where(Booking.user_id == user.id).order_by(Booking.created_at.desc(), Booking.id.desc())).all()
    return CustomerDetail(user=user_out(user, db), bookings=bookings_out(db, list(bookings)))
