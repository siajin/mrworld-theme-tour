import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import DbDep, StaffUser
from app.models import Booking, Departure, Package, PackageItinerary, Theme, now
from app.schemas.package import DepartureIn, DepartureOut, PackageIn, PackageOut, PublishIn
from app.services import pricing
from app.services.presenters import departure_out, package_out

router = APIRouter(prefix="/staff/packages", tags=["staff:packages"])


def _get(db: Session, package_id: int) -> Package:
    package = db.get(Package, package_id)
    if package is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없어요")
    return package


def _new_slug(db: Session) -> str:
    """직원 화면에서 만든 상품의 내부 slug. 시드 상품은 사람이 읽는 slug 를 쓴다."""
    while True:
        slug = f"pkg-{uuid.uuid4().hex[:8]}"
        if db.scalar(select(Package.id).where(Package.slug == slug)) is None:
            return slug


def _apply(db: Session, package: Package, payload: PackageIn) -> None:
    theme = db.get(Theme, payload.theme_id)
    if theme is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "존재하지 않는 테마예요")
    seen: set[str] = set()
    for sp in payload.style_prices:
        if sp.style_code in seen:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "스타일 가격이 중복됐어요")
        seen.add(sp.style_code)
        if not theme.allows_style(pricing.STYLES[sp.style_code].rank):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{theme.name} 테마는 {pricing.style_name(sp.style_code)} 스타일을 판매할 수 없어요")
    if payload.is_published and not payload.style_prices:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "스타일 가격을 먼저 등록해야 공개할 수 있어요")
    for key in ("theme_id", "title", "subtitle", "region", "country", "nights", "days", "hero_images", "summary", "highlights", "includes", "excludes", "notes", "badges", "is_published", "rating", "review_count"):
        setattr(package, key, getattr(payload, key))
    package.set_style_prices({sp.style_code: sp.price for sp in payload.style_prices})
    package.itinerary = [
        PackageItinerary(
            day_no=d.day_no,
            title=d.title,
            places=d.places,
            breakfast=d.meals.breakfast,
            lunch=d.meals.lunch,
            dinner=d.meals.dinner,
            lodging=d.lodging,
            description=d.description,
        )
        for d in payload.itinerary
    ]
    package.updated_at = now()


@router.get("", response_model=list[PackageOut])
def list_packages(db: DbDep, _: StaffUser, theme: str | None = None, published: bool | None = None, q: str | None = None) -> list[PackageOut]:
    stmt = select(Package).join(Theme)
    if theme:
        stmt = stmt.where(Theme.slug == theme)
    if published is not None:
        stmt = stmt.where(Package.is_published.is_(published))
    if q:
        stmt = stmt.where(or_(Package.title.contains(q), Package.region.contains(q), Package.country.contains(q)))
    return [package_out(db, p) for p in db.scalars(stmt.order_by(Package.id)).all()]


@router.post("", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
def create_package(payload: PackageIn, db: DbDep, _: StaffUser) -> PackageOut:
    package = Package(slug="")
    _apply(db, package, payload)
    package.slug = _new_slug(db)
    db.add(package)
    db.commit()
    db.refresh(package)
    return package_out(db, package)


@router.get("/{package_id}", response_model=PackageOut)
def get_package(package_id: int, db: DbDep, _: StaffUser) -> PackageOut:
    return package_out(db, _get(db, package_id))


@router.put("/{package_id}", response_model=PackageOut)
def update_package(package_id: int, payload: PackageIn, db: DbDep, _: StaffUser) -> PackageOut:
    package = _get(db, package_id)
    _apply(db, package, payload)
    db.commit()
    db.refresh(package)
    return package_out(db, package)


@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_package(package_id: int, db: DbDep, _: StaffUser) -> None:
    package = _get(db, package_id)
    if db.scalar(select(func.count(Booking.id)).where(Booking.package_id == package.id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "예약 이력이 있는 상품은 삭제할 수 없어요. 대신 비공개로 바꿔 주세요")
    db.delete(package)
    db.commit()


@router.post("/{package_id}/publish", response_model=PackageOut)
def publish(package_id: int, payload: PublishIn, db: DbDep, _: StaffUser) -> PackageOut:
    package = _get(db, package_id)
    if payload.is_published and not package.style_prices:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "스타일 가격을 먼저 등록해야 공개할 수 있어요")
    package.is_published = payload.is_published
    package.updated_at = now()
    db.commit()
    db.refresh(package)
    return package_out(db, package)


# ---------- 출발일정

def _get_departure(db: Session, package: Package, departure_id: int) -> Departure:
    dep = db.get(Departure, departure_id)
    if dep is None or dep.package_id != package.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "출발일정을 찾을 수 없어요")
    return dep


@router.post("/{package_id}/departures", response_model=DepartureOut, status_code=status.HTTP_201_CREATED)
def create_departure(package_id: int, payload: DepartureIn, db: DbDep, _: StaffUser) -> DepartureOut:
    package = _get(db, package_id)
    dep = Departure(package_id=package.id, **payload.model_dump())
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return departure_out(dep, 0)


@router.put("/{package_id}/departures/{departure_id}", response_model=DepartureOut)
def update_departure(package_id: int, departure_id: int, payload: DepartureIn, db: DbDep, _: StaffUser) -> DepartureOut:
    dep = _get_departure(db, _get(db, package_id), departure_id)
    booked = dep.booked
    if payload.capacity < booked:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"이미 {booked}명이 예약되어 있어 정원을 그보다 줄일 수 없어요")
    for key, value in payload.model_dump().items():
        setattr(dep, key, value)
    db.commit()
    db.refresh(dep)
    return departure_out(dep, booked)


@router.delete("/{package_id}/departures/{departure_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_departure(package_id: int, departure_id: int, db: DbDep, _: StaffUser) -> None:
    dep = _get_departure(db, _get(db, package_id), departure_id)
    if db.scalar(select(func.count(Booking.id)).where(Booking.departure_id == dep.id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "예약이 있는 출발일정은 삭제할 수 없어요. 상태를 closed 로 바꿔 주세요")
    db.delete(dep)
    db.commit()
