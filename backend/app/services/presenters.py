"""Presenter 함수군: ORM 객체를 api-contract.md 의 응답 스키마(DTO)로 변환한다.

규칙 계산은 도메인 모델(Package.from_price, Departure.remaining, Booking.needed_more …)과 서비스(LoyaltyPolicy)에 맡기고,
여기서는 목록 응답을 위한 일괄 조회(booked_map)와 필드 매핑만 한다.
"""
from collections.abc import Iterable
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, Departure, InventoryItem, InventoryMove, Notification, Package, Theme, User
from app.schemas.booking import (
    BookingAddonOut,
    BookingCustomer,
    BookingOut,
    BookingTheme,
    Quote,
    TravelerOut,
    TripOut,
)
from app.schemas.inventory import InventoryItemOut, InventoryMoveOut
from app.schemas.notification import NotificationOut
from app.schemas.package import (
    DepartureOut,
    ItineraryDay,
    ItineraryMeals,
    NextDeparture,
    PackageCard,
    PackageOut,
    StylePriceOut,
)
from app.schemas.theme import ThemeBrief, ThemeOut, ThemePerkOut
from app.schemas.user import UserOut
from app.services import pricing
from app.services.app_settings import SettingsStore
from app.services.loyalty import LoyaltyPolicy

# ---------- 공통 계산

def booked_map(db: Session, departure_ids: Iterable[int]) -> dict[int, int]:
    """출발일정별 예약 인원(Departure.booked 와 같은 규칙)을 목록 응답용으로 한 번의 쿼리로 구한다."""
    ids = list(set(departure_ids))
    if not ids:
        return {}
    rows = db.execute(
        select(Booking.departure_id, func.coalesce(func.sum(Booking.travelers_count), 0))
        .where(Booking.departure_id.in_(ids), Booking.status != "cancelled")
        .group_by(Booking.departure_id)
    ).all()
    return {dep_id: int(total) for dep_id, total in rows}


# ---------- 사용자

def user_out(user: User, db: Session | None = None) -> UserOut:
    out = UserOut(
        id=user.id, email=user.email, role=user.role, name=user.name, phone=user.phone, address=user.address, created_at=user.created_at
    )
    if not user.is_staff and db is not None:
        out.loyalty = LoyaltyPolicy(SettingsStore(db).load()).loyalty_of(user)
    return out


# ---------- 테마

def theme_out(theme: Theme, db: Session | None = None, with_stats: bool = False) -> ThemeOut:
    out = ThemeOut(
        id=theme.id,
        slug=theme.slug,
        name=theme.name,
        tagline=theme.tagline,
        description=theme.description,
        icon=theme.icon,
        hero_image=theme.hero_image,
        min_style_rank=theme.min_style_rank,
        min_travelers=theme.min_travelers,
        vehicle_label=theme.vehicle_label,
        default_transport=theme.default_transport,
        sort_order=theme.sort_order,
        is_active=theme.is_active,
        perks=[
            ThemePerkOut(
                id=p.id, label=p.label, inventory_item_id=p.inventory_item_id, qty_per_booking=p.qty_per_booking, per_person=p.per_person,
                unit=p.inventory_item.unit if p.inventory_item else "회"
            )
            for p in theme.perks
        ],
    )
    if with_stats and db is not None:
        published = db.scalars(select(Package).where(Package.theme_id == theme.id, Package.is_published.is_(True))).all()
        out.package_count = len(published)
        prices = [p.from_price()[0] for p in published if p.style_prices]
        out.from_price = min(prices) if prices else None
    return out


# ---------- 패키지 / 출발일정

def departure_out(dep: Departure, booked: int) -> DepartureOut:
    return DepartureOut(
        id=dep.id,
        package_id=dep.package_id,
        depart_date=dep.depart_date,
        return_date=dep.return_date,
        capacity=dep.capacity,
        booked=booked,
        remaining=max(0, dep.capacity - booked),
        status=dep.status,
    )


def next_departure_of(package: Package, booked: dict[int, int], today: date) -> NextDeparture | None:
    for dep in sorted(package.departures, key=lambda d: d.depart_date):
        if not dep.is_bookable(today):
            continue
        remaining = dep.capacity - booked.get(dep.id, 0)
        if remaining > 0:
            return NextDeparture(id=dep.id, depart_date=dep.depart_date, remaining=remaining)
    return None


def package_card(package: Package, booked: dict[int, int], today: date | None = None) -> PackageCard:
    today = today or date.today()
    from_price, from_style = package.from_price()
    return PackageCard(
        id=package.id,
        theme=ThemeBrief(id=package.theme.id, slug=package.theme.slug, name=package.theme.name),
        title=package.title,
        subtitle=package.subtitle,
        region=package.region,
        country=package.country,
        nights=package.nights,
        days=package.days,
        hero_images=list(package.hero_images or []),
        from_price=from_price,
        from_style=from_style,
        badges=list(package.badges or []),
        next_departure=next_departure_of(package, booked, today),
        rating=package.rating,
        review_count=package.review_count,
        is_published=package.is_published,
    )


def package_cards(db: Session, packages: list[Package]) -> list[PackageCard]:
    booked = booked_map(db, (d.id for p in packages for d in p.departures))
    today = date.today()
    return [package_card(p, booked, today) for p in packages]


def package_out(db: Session, package: Package) -> PackageOut:
    booked = booked_map(db, (d.id for d in package.departures))
    card = package_card(package, booked)
    return PackageOut(
        **card.model_dump(),
        summary=package.summary,
        includes=list(package.includes or []),
        excludes=list(package.excludes or []),
        notes=package.notes,
        highlights=list(package.highlights or []),
        style_prices=[
            StylePriceOut(style_code=sp.style_code, price=sp.price, available=package.theme.allows_style(pricing.STYLES[sp.style_code].rank))
            for sp in sorted(package.style_prices, key=lambda s: pricing.STYLES[s.style_code].rank)
        ],
        itinerary=[
            ItineraryDay(
                day_no=it.day_no,
                title=it.title,
                places=list(it.places or []),
                meals=ItineraryMeals(breakfast=it.breakfast, lunch=it.lunch, dinner=it.dinner),
                lodging=it.lodging,
                description=it.description,
            )
            for it in package.itinerary
        ],
        departures=[departure_out(d, booked.get(d.id, 0)) for d in package.departures],
        created_at=package.created_at,
        updated_at=package.updated_at,
    )


# ---------- 예약

def booking_out(db: Session, booking: Booking, booked: dict[int, int] | None = None) -> BookingOut:
    package = booking.package
    theme = package.theme
    if booked is None:
        booked = booked_map(db, (d.id for d in package.departures))
    return BookingOut(
        id=booking.id,
        code=booking.code,
        status=booking.status,
        customer=BookingCustomer(
            id=booking.customer.id, name=booking.customer.name, phone=booking.customer.phone, email=booking.customer.email
        ),
        package=package_card(package, booked),
        departure=departure_out(booking.departure, booked.get(booking.departure_id, 0)),
        theme=BookingTheme(slug=theme.slug, name=theme.name, min_travelers=theme.min_travelers,
                           perks=[ThemePerkOut.model_validate(p) for p in booking.included_perks]),
        style_code=booking.style_code,
        hotel_grade=booking.hotel_grade,
        meal_code=booking.meal_code,
        transport_code=booking.transport_code,
        addons=[BookingAddonOut(meal_addon_id=a.meal_addon_id, label=a.label, qty=a.qty, unit_price=a.unit_price) for a in booking.addons],
        travelers_count=booking.travelers_count,
        travelers=[
            TravelerOut(
                id=t.id,
                user_id=t.user_id,
                name=t.name,
                phone=t.phone,
                birth=t.birth,
                is_representative=t.is_representative,
                joined_via_code=t.joined_via_code,
            )
            for t in booking.travelers
        ],
        quote=Quote.model_validate(booking.quote),
        invite_code=booking.invite_code,
        needed_more=booking.needed_more,
        paid_at=booking.paid_at,
        confirmed_at=booking.confirmed_at,
        created_at=booking.created_at,
        memo=booking.memo,
    )


def bookings_out(db: Session, bookings: list[Booking]) -> list[BookingOut]:
    booked = booked_map(db, (d.id for b in bookings for d in b.package.departures))
    return [booking_out(db, b, booked) for b in bookings]


def trip_out(booking: Booking) -> TripOut:
    package = booking.package
    images = list(package.hero_images or [])
    return TripOut(
        booking_id=booking.id,
        code=booking.code,
        package_title=package.title,
        theme_name=package.theme.name,
        region=package.region,
        depart_date=booking.departure.depart_date,
        return_date=booking.departure.return_date,
        nights=package.nights,
        days=package.days,
        style_code=booking.style_code,
        style_name=pricing.style_name(booking.style_code),
        total=booking.total,
        status=booking.status,
        hero_image=images[0] if images else "",
    )


# ---------- 알림 / 창고

def notification_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id,
        user_id=n.user_id,
        user_name=n.user.name if n.user else "",
        channel="sms",
        template=n.template,
        title=n.title,
        body=n.body,
        status=n.status,
        created_at=n.created_at,
        sent_at=n.sent_at,
        provider=(n.payload or {}).get("provider"),
        to=(n.payload or {}).get("to"),
        error=(n.payload or {}).get("error"),
    )


def inventory_item_out(item: InventoryItem) -> InventoryItemOut:
    return InventoryItemOut(
        id=item.id,
        sku=item.sku,
        name=item.name,
        category=item.category,
        unit=item.unit,
        stock_qty=item.stock_qty,
        reorder_level=item.reorder_level,
        is_active=item.is_active,
        low_stock=item.low_stock,
    )


def inventory_move_out(m: InventoryMove) -> InventoryMoveOut:
    return InventoryMoveOut(
        id=m.id,
        item_id=m.item_id,
        item_name=m.item.name,
        type=m.type,
        qty=m.qty,
        ref_booking_id=m.ref_booking_id,
        memo=m.memo,
        created_by_name=m.creator.name if m.creator else "시스템",
        created_at=m.created_at,
    )
