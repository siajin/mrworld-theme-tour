from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DbDep, OptionalUser
from app.models import Booking, User
from app.schemas.booking import BookingCreate, BookingOut, InvitePreview, JoinIn, PayIn, Quote, QuoteRequest, TravelerIn
from app.services.booking import BookingService
from app.services.presenters import booking_out

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _own_booking(db: DbDep, booking_id: int, user: User, *, representative_only: bool = False) -> Booking:
    """접근 권한 검사만 하고(403) 규칙은 BookingService 에 묻는다."""
    service = BookingService(db)
    booking = service.get_or_404(booking_id)
    allowed = service.can_manage(booking, user) if representative_only else service.can_view(booking, user)
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "이 예약에 접근할 권한이 없어요")
    return booking


@router.post("/quote", response_model=Quote)
def quote(payload: QuoteRequest, db: DbDep, user: OptionalUser) -> Quote:
    return BookingService(db).quote(user, payload)


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, db: DbDep, user: CurrentUser) -> BookingOut:
    return booking_out(db, BookingService(db).create(user, payload))


@router.post("/join", response_model=BookingOut)
def join(payload: JoinIn, db: DbDep, user: CurrentUser) -> BookingOut:
    return booking_out(db, BookingService(db).join_by_code(user, payload.invite_code))


@router.get("/invite/{invite_code}", response_model=InvitePreview)
def invite_preview(invite_code: str, db: DbDep) -> InvitePreview:
    return BookingService(db).invite_preview(invite_code)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: DbDep, user: CurrentUser) -> BookingOut:
    return booking_out(db, _own_booking(db, booking_id, user))


@router.post("/{booking_id}/pay", response_model=BookingOut)
def pay(booking_id: int, payload: PayIn, db: DbDep, user: CurrentUser) -> BookingOut:
    booking = _own_booking(db, booking_id, user, representative_only=True)
    return booking_out(db, BookingService(db).pay(booking, payload.method))


@router.post("/{booking_id}/travelers", response_model=BookingOut)
def add_traveler(booking_id: int, payload: TravelerIn, db: DbDep, user: CurrentUser) -> BookingOut:
    booking = _own_booking(db, booking_id, user, representative_only=True)
    return booking_out(db, BookingService(db).add_traveler(booking, payload))


@router.delete("/{booking_id}/travelers/{traveler_id}", response_model=BookingOut)
def remove_traveler(booking_id: int, traveler_id: int, db: DbDep, user: CurrentUser) -> BookingOut:
    booking = _own_booking(db, booking_id, user, representative_only=True)
    return booking_out(db, BookingService(db).remove_traveler(booking, traveler_id))


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: int, db: DbDep, user: CurrentUser) -> BookingOut:
    booking = _own_booking(db, booking_id, user, representative_only=True)
    return booking_out(db, BookingService(db).cancel(booking))
