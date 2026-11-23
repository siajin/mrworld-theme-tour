"""예약 상태 기계 (api-contract.md §4).

클래스
- BookingService: 예약 생명주기 전체 — 견적(quote), 생성(create), 결제(pay), 직원 확정(confirm_by_staff), 취소(cancel),
  완료(complete), 동행 추가·삭제(add_traveler/remove_traveler), 초대 코드 합류(join_by_code)·미리보기(invite_preview).
  PricingEngine·LoyaltyPolicy·InventoryService·NotificationService 를 조합해 쓴다.
기존 모듈 함수(create_booking, transition_to_confirmed …)는 호환용 얇은 래퍼다.

pending ──pay──▶ confirmed   (travelers_count >= theme.min_travelers)
        └─pay──▶ gathering ──동행 합류/추가──▶ confirmed
pending | gathering | confirmed ──cancel──▶ cancelled
confirmed ──staff complete──▶ completed  (대표자·회원 동행 completed_trips +1)

확정 여부는 예약 1건(대표자 + 동행)의 travelers_count 로만 판단하고, 다른 예약과 합산하지 않는다.
"""
import secrets
import string
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Booking, BookingAddon, BookingTraveler, Departure, MealAddon, Notification, Package, User, now
from app.schemas.booking import AddonIn, BookingCreate, InvitePreview, Quote, QuoteRequest, TravelerIn
from app.services.app_settings import SettingsStore
from app.services.inventory import InventoryService
from app.services.loyalty import LoyaltyPolicy
from app.services.notification import NotificationService
from app.services.pricing import AddonLine, PricingEngine, PricingInput

INVITE_ALPHABET = string.ascii_uppercase + string.digits


def _bad(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, msg)


def _not_found(msg: str) -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, msg)


def booking_code(booking_id: int) -> str:
    """예약번호 MW-YYYY-NNNNNN (YYYY = 예약 생성 연도, NNNNNN = 예약 id)."""
    return f"MW-{date.today().year}-{booking_id:06d}"


class BookingService:
    """예약 생명주기(상태 기계)를 책임진다. 세션을 생성자로 받고, 각 공개 메서드가 커밋까지 끝낸다 (build·transition 제외)."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.pricing = PricingEngine()

    # ---------- 조회

    def get_or_404(self, booking_id: int) -> Booking:
        """예약을 찾고 없으면 404."""
        booking = self.db.get(Booking, booking_id)
        if booking is None:
            raise _not_found("예약을 찾을 수 없어요")
        return booking

    def can_view(self, booking: Booking, user: User) -> bool:
        """본인(대표자) 또는 회원 동행 또는 직원이면 볼 수 있다."""
        if self.can_manage(booking, user):
            return True
        return any(t.user_id == user.id for t in booking.travelers)

    def can_manage(self, booking: Booking, user: User) -> bool:
        """결제·인원 변경·취소는 대표자 본인 또는 직원만."""
        return user.is_staff or booking.user_id == user.id

    def find_by_invite_code(self, invite_code: str) -> Booking:
        """초대 코드(대소문자 무시)로 예약을 찾고 없으면 404."""
        booking = self.db.scalar(select(Booking).where(Booking.invite_code == invite_code.strip().upper()))
        if booking is None:
            raise _not_found("초대 코드를 찾을 수 없어요")
        return booking

    def invite_preview(self, invite_code: str) -> InvitePreview:
        """초대 링크 화면용 요약 (합류 전 비로그인도 볼 수 있다)."""
        booking = self.find_by_invite_code(invite_code)
        rep = next((t for t in booking.travelers if t.is_representative), None)
        return InvitePreview(
            booking_id=booking.id,
            package_title=booking.package.title,
            theme_name=booking.package.theme.name,
            depart_date=booking.departure.depart_date,
            representative_name=rep.name if rep else booking.customer.name,
            travelers_count=booking.travelers_count,
            min_travelers=booking.package.theme.min_travelers,
            needed_more=booking.needed_more,
        )

    # ---------- 내부 도우미

    def _check_party_size(self, package: Package, count: int) -> None:
        """허니문은 차량을 변경해도 예약 1건당 최대 두 명이다."""
        if package.theme.slug == "honeymoon" and count > 2:
            raise _bad("허니문 낭만 투어는 2인 전용으로 최대 2명까지만 예약할 수 있어요")

    def _lock_booking(self, booking: Booking) -> None:
        """동일 예약의 결제·인원 변경·취소를 직렬화한다(SQLite에서도 쓰기 잠금)."""
        self.db.execute(update(Booking).where(Booking.id == booking.id).values(id=Booking.id).execution_options(synchronize_session=False))
        self.db.refresh(booking)

    def _lock_departure(self, departure: Departure) -> None:
        """다른 예약의 동시 생성·동행 추가에서도 정원 검사를 직렬화한다."""
        self.db.execute(update(Departure).where(Departure.id == departure.id).values(id=Departure.id).execution_options(synchronize_session=False))
        self.db.refresh(departure)

    def _load_addons(self, addons: list[AddonIn]) -> tuple[AddonLine, ...]:
        """요청의 추가옵션 id 를 활성 MealAddon 행으로 확인해 가격 줄로 바꾼다."""
        lines: list[AddonLine] = []
        for a in addons:
            row = self.db.get(MealAddon, a.meal_addon_id)
            if row is None or not row.is_active:
                raise _bad("선택할 수 없는 추가옵션이 있어요")
            lines.append(AddonLine(meal_addon_id=row.id, label=row.label, unit_price=row.price, qty=a.qty))
        return tuple(lines)

    def _style_price(self, package: Package, style_code: str) -> int:
        """상품의 스타일 1인 가격. 가격표에 없으면 테마 규칙 위반 메시지를 우선하고, 아니면 400."""
        price = package.price_for(style_code)
        if price is not None:
            return price
        self.pricing.validate_style_for_theme(style_code, package.theme.min_style_rank)
        raise _bad("이 상품에서는 선택할 수 없는 스타일이에요")

    def _quote_for(self, package: Package, req: QuoteRequest, addon_lines: tuple[AddonLine, ...], travelers_count: int, user: User | None) -> Quote:
        """상품·요청 옵션·인원·사용자 등급으로 PricingInput 을 만들어 엔진에 넘긴다."""
        self._check_party_size(package, travelers_count)
        settings = SettingsStore(self.db).load()
        return self.pricing.calculate(
            PricingInput(
                style_code=req.style_code,
                style_price=self._style_price(package, req.style_code),
                nights=package.nights,
                days=package.days,
                travelers_count=travelers_count,
                theme_min_style_rank=package.theme.min_style_rank,
                theme_default_transport=package.theme.default_transport,
                hotel_grade=req.hotel_grade,
                meal_code=req.meal_code,
                transport_code=req.transport_code,
                addons=addon_lines,
                loyalty_rate=LoyaltyPolicy(settings).rate_for(user),
                deposit_rate=settings.deposit_rate,
            )
        )

    def _load_package_departure(self, package_id: int, departure_id: int) -> tuple[Package, Departure]:
        """공개된 상품과 그 상품에 속한 출발일정을 찾는다 (없으면 404)."""
        package = self.db.get(Package, package_id)
        if package is None or not package.is_published or not package.theme.is_active:
            raise _not_found("상품을 찾을 수 없어요")
        departure = self.db.get(Departure, departure_id)
        if departure is None or departure.package_id != package.id:
            raise _not_found("출발일정을 찾을 수 없어요")
        return package, departure

    def _check_capacity(self, departure: Departure, additional: int) -> None:
        """정원 검사. 현재 예약 인원 + 추가 인원이 정원을 넘으면 400."""
        if departure.booked + additional > departure.capacity:
            raise _bad(f"이 출발일정은 잔여 {departure.remaining}명만 예약할 수 있어요")

    def _check_departure_open(self, departure: Departure) -> None:
        """대기 중 일정이 마감되거나 출발일이 지난 경우에도 신규 결제·합류를 막는다."""
        if departure.status != "open":
            raise _bad("예약이 마감된 출발일정이에요")
        if departure.depart_date < date.today():
            raise _bad("이미 지난 출발일정이에요")

    def _new_invite_code(self) -> str:
        """8자리 영숫자 초대 코드 (중복 없음)."""
        while True:
            code = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))
            if self.db.scalar(select(Booking.id).where(Booking.invite_code == code)) is None:
                return code

    def _notify_payload(self, booking: Booking) -> dict:
        """알림 템플릿 공통 치환값 (상품명·출발 월/일·예약번호)."""
        dep = booking.departure.depart_date
        return {"package_title": booking.package.title, "depart_md": f"{dep.month}/{dep.day}", "code": booking.code}

    def _save(self, booking: Booking) -> Booking:
        """커밋 후 최신 상태로 다시 읽는다."""
        self.db.commit()
        self.db.refresh(booking)
        return booking

    # ---------- 견적

    def quote(self, user: User | None, req: QuoteRequest) -> Quote:
        """예약 전 견적. 로그인 고객이면 단골 할인을 반영한다."""
        package, _departure = self._load_package_departure(req.package_id, req.departure_id)
        quote = self._quote_for(package, req, self._load_addons(req.addons), req.travelers_count, user)
        InventoryService(self.db).check_theme_perks(package.theme, req.travelers_count)
        return quote

    def recompute_quote(self, booking: Booking) -> None:
        """인원 변경 시 저장된 옵션으로 견적을 다시 계산해 스냅샷·총액·예약금을 갱신한다."""
        req = QuoteRequest(
            package_id=booking.package_id,
            departure_id=booking.departure_id,
            style_code=booking.style_code,
            hotel_grade=booking.hotel_grade,
            meal_code=booking.meal_code,
            transport_code=booking.transport_code,
            addons=[AddonIn(meal_addon_id=a.meal_addon_id, qty=a.qty) for a in booking.addons],
            travelers_count=booking.travelers_count,
        )
        addon_lines = tuple(AddonLine(meal_addon_id=a.meal_addon_id, label=a.label, unit_price=a.unit_price, qty=a.qty) for a in booking.addons)
        q = self._quote_for(booking.package, req, addon_lines, booking.travelers_count, booking.customer)
        booking.quote = {**q.model_dump(), "_theme_perks": booking.included_perks}
        booking.total = q.total
        booking.deposit = q.deposit

    # ---------- 생성 / 결제

    def build(self, user: User, package: Package, departure: Departure, payload: BookingCreate) -> Booking:
        """검증 없이 예약 행(옵션·여행자 포함)을 만들고 flush 해 코드를 부여한다. 커밋은 호출자가 한다.
        고객 API 는 create 를, 시드는 이 메서드를 직접 쓴다."""
        addon_lines = self._load_addons(payload.addons)
        q = self._quote_for(package, payload, addon_lines, payload.travelers_count, user)

        booking = Booking(
            code="",
            user_id=user.id,
            package_id=package.id,
            departure_id=departure.id,
            status="pending",
            style_code=payload.style_code,
            hotel_grade=q.resolved.hotel_grade,
            meal_code=q.resolved.meal_code,
            transport_code=q.resolved.transport_code,
            travelers_count=payload.travelers_count,
            quote={**q.model_dump(), "_theme_perks": package.theme.perk_snapshot()},
            total=q.total,
            deposit=q.deposit,
            memo=payload.memo,
        )
        for a in addon_lines:
            booking.addons.append(BookingAddon(meal_addon_id=a.meal_addon_id, label=a.label, qty=a.qty, unit_price=a.unit_price))
        for t in payload.travelers:
            booking.travelers.append(
                BookingTraveler(
                    # 대표자 행은 예약자 계정과 연결한다.
                    user_id=user.id if t.is_representative else None,
                    name=t.name,
                    phone=t.phone,
                    birth=t.birth,
                    is_representative=t.is_representative,
                )
            )
        self.db.add(booking)
        self.db.flush()
        booking.code = booking_code(booking.id)
        return booking

    def create(self, user: User, payload: BookingCreate) -> Booking:
        """고객의 예약 생성(pending). 직원 계정·마감/지난 일정·정원 초과는 400."""
        if user.is_staff:
            raise _bad("직원 계정으로는 예약할 수 없어요. 고객 계정으로 로그인해 주세요")
        package, departure = self._load_package_departure(payload.package_id, payload.departure_id)
        self._lock_departure(departure)
        self._check_departure_open(departure)
        self._check_capacity(departure, payload.travelers_count)
        InventoryService(self.db).check_theme_perks(package.theme, payload.travelers_count)
        return self._save(self.build(user, package, departure, payload))

    def pay(self, booking: Booking, method: str) -> Booking:
        """예약금 결제 시뮬레이션. 결제 후 인원이 충족되면 confirmed, 아니면 gathering(초대 코드 발급 + 접수 문자)."""
        self._lock_booking(booking)
        if booking.status != "pending":
            raise _bad("결제 대기 상태의 예약만 결제할 수 있어요")
        self._check_party_size(booking.package, booking.travelers_count)
        self._check_departure_open(booking.departure)
        booking.payment_method = method
        booking.paid_at = now()
        notifier = NotificationService(self.db)
        InventoryService(self.db).reserve_theme_perks(booking, booking.package.theme, notifier)
        if booking.needed_more == 0:
            self.transition_to_confirmed(booking, notifier)
        else:
            booking.status = "gathering"
            booking.invite_code = self._new_invite_code()
            # 대표자에게 접수 문자 (초대 코드 포함) — 동행에게는 확정될 때 보낸다
            rep = next((t for t in booking.travelers if t.is_representative), None)
            rep_user = self.db.get(User, booking.user_id)
            rep_phone = (rep.phone if rep and rep.phone else None) or (rep_user.phone if rep_user else "")
            payload = {**self._notify_payload(booking), "needed_more": booking.needed_more, "invite_code": booking.invite_code}
            notifier.send_to_phone(booking.user_id, rep_phone, "booking_received", payload)
        return self._save(booking)

    # ---------- 확정 / 취소 / 완료

    def transition_to_confirmed(self, booking: Booking, notifier: NotificationService) -> list[Notification]:
        """confirmed 전이 공통 처리: confirmed_at, 테마 물품 출고, 대표자·회원 동행 알림. 만든 알림 행을 돌려준다 (커밋 없음)."""
        if booking.status not in ("pending", "gathering"):
            raise _bad("결제 대기·동행 모집 중 예약만 확정할 수 있어요")
        self._check_party_size(booking.package, booking.travelers_count)
        booking.status = "confirmed"
        booking.confirmed_at = now()
        InventoryService(self.db).reserve_theme_perks(booking, booking.package.theme, notifier)
        return notifier.send_to_booking(booking, "booking_confirmed", self._notify_payload(booking))

    def confirm_by_staff(self, booking: Booking) -> Booking:
        """직원 수동 확정. 최소 인원 미달이어도 확정 가능. 미결제면 계좌이체로 결제 처리한다."""
        self._lock_booking(booking)
        if booking.status not in ("pending", "gathering"):
            raise _bad("결제 대기·동행 모집 중 예약만 확정할 수 있어요")
        self._check_departure_open(booking.departure)
        if booking.paid_at is None:
            booking.paid_at = now()
            booking.payment_method = booking.payment_method or "transfer"
        self.transition_to_confirmed(booking, NotificationService(self.db))
        return self._save(booking)

    def cancel(self, booking: Booking) -> Booking:
        """취소. 결제된 예약이면 전원에게 취소 문자를 보낸다."""
        self._lock_booking(booking)
        if not booking.is_cancellable:
            raise _bad("취소할 수 없는 상태의 예약이에요")
        was_paid = booking.paid_at is not None
        booking.status = "cancelled"
        booking.cancelled_at = now()
        InventoryService(self.db).release_theme_perks(booking)
        if was_paid:
            NotificationService(self.db).send_to_booking(booking, "booking_cancelled", self._notify_payload(booking))
        return self._save(booking)

    def complete(self, booking: Booking) -> Booking:
        """출발 후 직원이 완료 처리. 대표자·회원 동행의 completed_trips +1 (같은 사람은 한 번만)."""
        self._lock_booking(booking)
        if booking.status != "confirmed":
            raise _bad("확정된 예약만 완료 처리할 수 있어요")
        if booking.departure.return_date > date.today():
            raise _bad("여행이 끝난 뒤에 완료 처리할 수 있어요")
        booking.status = "completed"
        booking.completed_at = now()
        for uid in booking.participant_user_ids():
            user = self.db.get(User, uid)
            if user is not None and not user.is_staff:
                user.completed_trips += 1
        return self._save(booking)

    # ---------- 동행 추가 / 삭제 / 합류

    def _after_travelers_changed(self, booking: Booking) -> None:
        """인원 변경 후 공통 처리: 인원 수 동기화, 견적 재계산, gathering 이면 확정 여부 재판정."""
        booking.travelers_count = len(booking.travelers)
        self.recompute_quote(booking)
        inventory = InventoryService(self.db)
        inventory.check_theme_perks(booking.package.theme, booking.travelers_count, booking)
        if booking.paid_at is not None:
            inventory.reserve_theme_perks(booking, booking.package.theme, NotificationService(self.db))
        if booking.status == "gathering" and booking.needed_more == 0:
            self.transition_to_confirmed(booking, NotificationService(self.db))

    def add_traveler(self, booking: Booking, traveler: TravelerIn, user: User | None = None, joined_via_code: bool = False) -> Booking:
        """동행 추가 (대표자가 직접, 또는 초대 코드로 회원이 합류). 확정 전 예약만, 정원 안에서만."""
        self._lock_booking(booking)
        if not booking.can_change_travelers:
            raise _bad("확정된 예약은 인원을 변경할 수 없어요. 고객센터로 문의해 주세요")
        self._lock_departure(booking.departure)
        self._check_departure_open(booking.departure)
        if user is not None and any(t.user_id == user.id for t in booking.travelers):
            raise _bad("이미 이 예약에 포함된 회원이에요")
        self._check_capacity(booking.departure, 1)

        booking.travelers.append(
            BookingTraveler(
                user_id=user.id if user is not None else None,
                name=traveler.name,
                phone=traveler.phone,
                birth=traveler.birth,
                is_representative=False,
                joined_via_code=joined_via_code,
            )
        )
        self.db.flush()
        self._after_travelers_changed(booking)

        if joined_via_code and booking.status == "gathering":
            # 아직 미달이면 대표자에게 합류 알림. 확정되었으면 booking_confirmed 알림이 이미 나갔다.
            NotificationService(self.db).send(
                booking.user_id,
                "companion_joined",
                {
                    **self._notify_payload(booking),
                    "companion_name": traveler.name,
                    "travelers_count": booking.travelers_count,
                    "needed_more": booking.needed_more,
                },
            )
        return self._save(booking)

    def remove_traveler(self, booking: Booking, traveler_id: int) -> Booking:
        """동행 삭제. 대표자는 지울 수 없고, 확정 전 예약만 가능."""
        self._lock_booking(booking)
        if not booking.can_change_travelers:
            raise _bad("확정된 예약은 인원을 변경할 수 없어요. 고객센터로 문의해 주세요")
        target = next((t for t in booking.travelers if t.id == traveler_id), None)
        if target is None:
            raise _not_found("여행자를 찾을 수 없어요")
        if target.is_representative:
            raise _bad("대표자는 삭제할 수 없어요")
        booking.travelers.remove(target)
        self.db.flush()
        self._after_travelers_changed(booking)
        return self._save(booking)

    def join_by_code(self, user: User, invite_code: str) -> Booking:
        """초대 코드로 회원이 동행 합류. 모집 중(gathering) 예약에 고객 계정만."""
        booking = self.find_by_invite_code(invite_code)
        if booking.status != "gathering":
            raise _bad("동행 모집이 끝난 예약이에요")
        if user.is_staff:
            raise _bad("직원 계정으로는 동행 합류를 할 수 없어요")
        traveler = TravelerIn(name=user.name, phone=user.phone)
        return self.add_traveler(booking, traveler, user=user, joined_via_code=True)


# ---------- 호환 래퍼 (시드·기존 호출부용). 규칙은 BookingService 에만 있다.

def participant_user_ids(booking: Booking) -> list[int]:
    return booking.participant_user_ids()


def quote(db: Session, req: QuoteRequest, user: User | None) -> Quote:
    return BookingService(db).quote(user, req)


def build_booking(db: Session, user: User, package: Package, departure: Departure, payload: BookingCreate) -> Booking:
    return BookingService(db).build(user, package, departure, payload)


def create_booking(db: Session, user: User, payload: BookingCreate) -> Booking:
    return BookingService(db).create(user, payload)


def pay(db: Session, booking: Booking, method: str) -> Booking:
    return BookingService(db).pay(booking, method)


def transition_to_confirmed(db: Session, booking: Booking, notifier: NotificationService) -> list[Notification]:
    return BookingService(db).transition_to_confirmed(booking, notifier)


def confirm_by_staff(db: Session, booking: Booking) -> Booking:
    return BookingService(db).confirm_by_staff(booking)


def cancel(db: Session, booking: Booking) -> Booking:
    return BookingService(db).cancel(booking)


def complete(db: Session, booking: Booking) -> Booking:
    return BookingService(db).complete(booking)


def add_traveler(db: Session, booking: Booking, traveler: TravelerIn, user: User | None = None, joined_via_code: bool = False) -> Booking:
    return BookingService(db).add_traveler(booking, traveler, user=user, joined_via_code=joined_via_code)


def remove_traveler(db: Session, booking: Booking, traveler_id: int) -> Booking:
    return BookingService(db).remove_traveler(booking, traveler_id)


def join(db: Session, user: User, invite_code: str) -> Booking:
    return BookingService(db).join_by_code(user, invite_code)
