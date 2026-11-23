from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import DbDep
from app.models import Package, Theme
from app.schemas.common import StyleCode
from app.schemas.package import DepartureOut, FeaturedOut, PackageCard, PackageOut
from app.services import pricing
from app.services.presenters import booked_map, departure_out, package_card, package_out

router = APIRouter(prefix="/packages", tags=["packages"])

SortKey = Literal["recommended", "price_asc", "price_desc", "departure_soon"]


def _published(db: Session) -> list[Package]:
    return list(db.scalars(select(Package).join(Theme).where(Package.is_published.is_(True), Theme.is_active.is_(True)).order_by(Package.id)).all())


def _cards(db: Session, packages: list[Package]) -> list[PackageCard]:
    booked = booked_map(db, (d.id for p in packages for d in p.departures))
    today = date.today()
    return [package_card(p, booked, today) for p in packages]


def _sort_cards(cards: list[PackageCard], sort: SortKey) -> list[PackageCard]:
    if sort == "price_asc":
        return sorted(cards, key=lambda c: c.from_price)
    if sort == "price_desc":
        return sorted(cards, key=lambda c: -c.from_price)
    if sort == "departure_soon":
        return sorted(cards, key=lambda c: (c.next_departure is None, c.next_departure.depart_date if c.next_departure else date.max))
    # recommended: 평점·리뷰 수 기반
    return sorted(cards, key=lambda c: (-c.rating * min(c.review_count, 1000), -c.review_count))


@router.get("", response_model=list[PackageCard])
def list_packages(
    db: DbDep,
    theme: str | None = None,
    style: StyleCode | None = None,
    region: str | None = None,
    depart_from: date | None = None,
    depart_to: date | None = None,
    travelers: int | None = Query(default=None, ge=1),
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    sort: SortKey = "recommended",
    q: str | None = None,
) -> list[PackageCard]:
    stmt = select(Package).join(Theme).where(Package.is_published.is_(True), Theme.is_active.is_(True))
    if theme:
        stmt = stmt.where(Theme.slug == theme)
    if region:
        stmt = stmt.where(or_(Package.region.contains(region), Package.country.contains(region)))
    if q:
        stmt = stmt.where(or_(Package.title.contains(q), Package.subtitle.contains(q), Package.region.contains(q), Package.country.contains(q)))
    packages = list(db.scalars(stmt.order_by(Package.id)).all())
    today = date.today()

    def departure_ok(p: Package, booked: dict[int, int]) -> bool:
        if not (depart_from or depart_to or travelers):
            return True
        for d in p.departures:
            if not d.is_bookable(today):
                continue
            if depart_from and d.depart_date < depart_from:
                continue
            if depart_to and d.depart_date > depart_to:
                continue
            if travelers and d.capacity - booked.get(d.id, 0) < travelers:
                continue
            return True
        return False

    booked = booked_map(db, (d.id for p in packages for d in p.departures))
    filtered: list[Package] = []
    for p in packages:
        if style and not (p.price_for(style) is not None and p.theme.allows_style(pricing.STYLES[style].rank)):
            continue
        if not departure_ok(p, booked):
            continue
        filtered.append(p)

    cards = [package_card(p, booked, today) for p in filtered]
    if min_price is not None:
        cards = [c for c in cards if c.from_price >= min_price]
    if max_price is not None:
        cards = [c for c in cards if c.from_price <= max_price]
    return _sort_cards(cards, sort)


@router.get("/featured", response_model=FeaturedOut)
def featured(db: DbDep) -> FeaturedOut:
    cards = _cards(db, _published(db))
    popular = _sort_cards([c for c in cards if "인기" in c.badges] or cards, "recommended")[:6]
    # 마감 임박: 가장 빠른 출발일정의 잔여가 4명 이하이거나 '출발 확정 임박' 뱃지
    closing = [c for c in cards if c.next_departure and (c.next_departure.remaining <= 4 or "출발 확정 임박" in c.badges)]
    closing_soon = _sort_cards(closing, "departure_soon")[:6]
    by_theme: dict[str, list[PackageCard]] = {}
    themes = db.scalars(select(Theme).where(Theme.is_active.is_(True)).order_by(Theme.sort_order, Theme.id)).all()
    for t in themes:
        by_theme[t.slug] = _sort_cards([c for c in cards if c.theme.slug == t.slug], "recommended")[:4]
    return FeaturedOut(popular=popular, closing_soon=closing_soon, by_theme=by_theme)


def _get_published(db: Session, package_id: int) -> Package:
    package = db.get(Package, package_id)
    if package is None or not package.is_published or not package.theme.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없어요")
    return package


@router.get("/{package_id}", response_model=PackageOut)
def get_package(package_id: int, db: DbDep) -> PackageOut:
    return package_out(db, _get_published(db, package_id))


@router.get("/{package_id}/departures", response_model=list[DepartureOut])
def get_departures(package_id: int, db: DbDep) -> list[DepartureOut]:
    package = _get_published(db, package_id)
    booked = booked_map(db, (d.id for d in package.departures))
    return [departure_out(d, booked.get(d.id, 0)) for d in package.departures]
