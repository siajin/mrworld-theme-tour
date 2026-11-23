from datetime import date, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.deps import DbDep, StaffUser
from app.models import Booking, Departure, InventoryItem, Notification
from app.schemas.staff import StaffDashboard, UpcomingDeparture
from app.services.presenters import booked_map, bookings_out, departure_out, inventory_item_out, notification_out

router = APIRouter(prefix="/staff/dashboard", tags=["staff:dashboard"])


@router.get("", response_model=StaffDashboard)
def dashboard(db: DbDep, _: StaffUser) -> StaffDashboard:
    today = date.today()
    day_start = datetime.combine(today, datetime.min.time())
    week_start = day_start - timedelta(days=today.weekday())  # 월요일 00:00
    month_start = day_start.replace(day=1)

    today_bookings = db.scalar(select(func.count(Booking.id)).where(Booking.created_at >= day_start)) or 0
    gathering = db.scalar(select(func.count(Booking.id)).where(Booking.status == "gathering")) or 0
    confirmed_week = db.scalar(select(func.count(Booking.id)).where(Booking.confirmed_at >= week_start)) or 0
    # 이번 달 매출 = 이번 달에 확정된(취소 안 된) 예약의 총액 합
    revenue = db.scalar(
        select(func.coalesce(func.sum(Booking.total), 0)).where(
            Booking.confirmed_at >= month_start, Booking.status.in_(("confirmed", "completed"))
        )
    ) or 0

    deps = db.scalars(
        select(Departure).where(Departure.depart_date >= today, Departure.status == "open").order_by(Departure.depart_date).limit(8)
    ).all()
    booked = booked_map(db, (d.id for d in deps))
    counts = dict(
        db.execute(
            select(Booking.departure_id, func.count(Booking.id))
            .where(Booking.departure_id.in_([d.id for d in deps] or [0]), Booking.status != "cancelled")
            .group_by(Booking.departure_id)
        ).all()
    )
    upcoming = [
        UpcomingDeparture(
            departure=departure_out(d, booked.get(d.id, 0)),
            package_title=d.package.title,
            theme_name=d.package.theme.name,
            bookings=int(counts.get(d.id, 0)),
        )
        for d in deps
    ]

    low_stock = [
        inventory_item_out(i)
        for i in db.scalars(select(InventoryItem).where(InventoryItem.is_active.is_(True)).order_by(InventoryItem.id)).all()
        if i.low_stock
    ]
    notifications = db.scalars(select(Notification).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(10)).all()
    recent = db.scalars(select(Booking).order_by(Booking.created_at.desc(), Booking.id.desc()).limit(10)).all()

    return StaffDashboard(
        today_bookings=int(today_bookings),
        gathering_bookings=int(gathering),
        confirmed_this_week=int(confirmed_week),
        revenue_this_month=int(revenue),
        upcoming_departures=upcoming,
        low_stock_items=low_stock,
        recent_notifications=[notification_out(n) for n in notifications],
        recent_bookings=bookings_out(db, list(recent)),
    )
