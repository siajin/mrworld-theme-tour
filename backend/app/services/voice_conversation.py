"""키 없이 실행하는 예약 대화. 선택값을 누적하고 실제 상품·일정·견적을 다시 확인한다."""
import calendar
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MealAddon, Package, Theme, User
from app.schemas.ai import ConversationIn, ConversationOut, ConversationState
from app.schemas.booking import AddonIn, QuoteRequest
from app.services.ai import QueryParser
from app.services.booking import BookingService
from app.services.presenters import package_cards
from app.services.pricing import STYLES


class VoiceConversationService:
    """인사→기념일→테마→스타일→추가옵션→선택확인→추가요청→예약 준비."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.parser = QueryParser()

    @staticmethod
    def _date(text: str, today: date) -> date | None:
        compact = re.sub(r"\s+", "", text)
        if "다음달" in compact or "내달" in compact:
            year, month = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
            match = re.search(r"(\d{1,2})일", compact)
            day = int(match.group(1)) if match else today.day if "오늘" in compact else 1
            return date(year, month, day if match else min(day, calendar.monthrange(year, month)[1]))
        match = re.search(r"(?:(\d{4})년)?(\d{1,2})월(\d{1,2})일", compact)
        if match:
            year = int(match.group(1)) if match.group(1) else today.year
            target = date(year, int(match.group(2)), int(match.group(3)))
            if not match.group(1) and target < today:
                target = date(year + 1, target.month, target.day)
            return target
        return None

    @staticmethod
    def _yes(text: str) -> bool:
        return text in {"네", "예", "응", "그래", "맞아", "좋아", "확인", "오케이"} or any(word in text for word in ("맞아요", "맞습니다", "좋아요", "좋겠", "좋습니다", "그렇게", "예약해", "예약할", "결제해", "진행해", "확인했"))

    @staticmethod
    def _no_more(text: str) -> bool:
        return text in {"아니요", "아니오", "아니", "없어", "괜찮아"} or any(word in text for word in ("없어요", "없습니다", "필요없", "괜찮아요", "이대로", "추가안"))

    def _available(self, state: ConversationState, today: date) -> list[Package]:
        packages = list(self.db.scalars(select(Package).join(Theme).where(Package.is_published.is_(True), Theme.is_active.is_(True))))
        count = state.travelers_count or (2 if state.theme_slug == "honeymoon" else 3)
        return [p for p in packages if (not state.theme_slug or p.theme.slug == state.theme_slug)
                and (not state.region or state.region in p.title + p.region + p.country)
                and any(d.is_bookable(today) and d.remaining >= count for d in p.departures)]

    def _selection(self, state: ConversationState, today: date):
        packages = self._available(state, today)
        if not packages:
            return None, None, []
        desired = date.fromisoformat(state.desired_date) if state.desired_date else None
        candidates = [(p, d) for p in packages for d in p.departures
                      if d.is_bookable(today) and d.remaining >= (state.travelers_count or (2 if p.theme.slug == "honeymoon" else 3))]
        def key(pair):
            p, d = pair
            if desired:
                return (0 if d.depart_date == desired else 1 if d.depart_date > desired else 2,
                        abs((d.depart_date - desired).days), -p.review_count, p.id)
            return (0 if p.id == state.package_id and d.id == state.departure_id else 1,
                    d.depart_date.toordinal(), -p.review_count, p.id)
        package, departure = min(candidates, key=key)
        state.package_id, state.departure_id = package.id, departure.id
        state.travelers_count = state.travelers_count or (2 if package.theme.slug == "honeymoon" else 3)
        return package, departure, packages

    def _addons(self, text: str, state: ConversationState) -> tuple[bool, str]:
        """인식된 수량은 덮어써서 같은 발화 재전송으로 중복 추가하지 않는다."""
        compact = re.sub(r"\s+", "", text)
        if "추가옵션" in compact and any(w in compact for w in ("전부빼", "모두빼", "전부없", "모두없", "삭제")):
            state.addons = []
            return True, ""
        words = [(m.start(), m.group()) for m in re.finditer(r"커피|샴페인|샴패인|샹페인|샹펜|와인|케이크", compact)]
        if not words:
            return False, ""
        rows = list(self.db.scalars(select(MealAddon).where(MealAddon.is_active.is_(True))))
        selected = {a.meal_addon_id: min(a.qty, 20) for a in state.addons}
        for i, (start, token) in enumerate(words):
            canonical = "샴페인" if token in {"샴패인", "샹페인", "샹펜"} else token
            addon = next((a for a in rows if canonical in a.label), None)
            if addon is None:
                return True, f"지금은 {canonical} 추가옵션을 선택할 수 없어요. 다른 옵션을 말씀해 주세요."
            end = words[i + 1][0] if i + 1 < len(words) else len(compact)
            part = compact[start:end]
            match = re.search(r"(\d{1,3})\s*(?:포트|병|잔|개|인분|세트)?", part)
            qty = int(match.group(1)) if match else 2 if any(w in part for w in ("두병", "두잔", "두포트", "두개")) else 1
            if qty > 20:
                return True, "식사 추가옵션은 한 종류당 20개 이내로 말씀해 주세요."
            if any(w in part for w in ("빼", "제외", "취소", "삭제", "추가하지마", "안넣")) or qty == 0:
                selected.pop(addon.id, None)
            else:
                selected[addon.id] = qty
        state.addons = [AddonIn(meal_addon_id=k, qty=v) for k, v in selected.items()]
        return True, ""

    def _summary(self, state: ConversationState, user: User | None, today: date):
        package, departure, packages = self._selection(state, today)
        if package is None:
            state.package_id = state.departure_id = None
            return None, "현재 조건으로 예약 가능한 출발일이 없어요. 다른 테마나 지역, 인원을 말씀해 주세요.", packages
        allowed = [s for s in STYLES if package.price_for(s) is not None and package.theme.allows_style(STYLES[s].rank)]
        if not allowed:
            return None, "이 상품의 스타일 가격이 아직 준비되지 않았어요. 다른 상품을 골라 주세요.", packages
        if state.style_code not in allowed:
            state.style_code = None
            return None, f"{package.theme.name}에서는 {'·'.join(STYLES[s].name for s in allowed)} 스타일을 선택할 수 있어요.", packages
        transport = package.theme.default_transport
        req = QuoteRequest(package_id=package.id, departure_id=departure.id, style_code=state.style_code,
                           travelers_count=state.travelers_count, transport_code=transport, addons=state.addons)
        try:
            quote = BookingService(self.db).quote(user, req)
        except HTTPException as error:
            return None, f"지금 조건으로 예약할 수 없어요. {error.detail} 인원이나 옵션을 바꿔 주세요.", packages
        state.quoted_total, state.quoted_deposit = quote.total, quote.deposit
        rows = {a.id: a for a in self.db.scalars(select(MealAddon).where(MealAddon.is_active.is_(True)))}
        extras = ", ".join(f"{rows[a.meal_addon_id].label} 1인당 {a.qty}개" for a in state.addons if a.meal_addon_id in rows) or "식사 추가옵션 없음"
        note = ""
        if state.desired_date and departure.depart_date.isoformat() != state.desired_date:
            note = f"희망하신 {state.desired_date}에는 가능한 일정이 없어 실제 가능한 {departure.depart_date} 출발로 안내해요. "
        summary = (f"{note}{package.theme.name}, {package.title}, {departure.depart_date} 출발, "
                   f"{STYLES[state.style_code].name} 스타일, {state.travelers_count}명, {extras}입니다. "
                   f"총 {quote.total:,}원, 예약금 {quote.deposit:,}원이에요.")
        return req, summary, packages

    def respond(self, payload: ConversationIn, user: User | None = None, today: date | None = None) -> ConversationOut:
        today = today or datetime.now(timezone(timedelta(hours=9))).date()
        state = payload.state.model_copy(deep=True) if payload.state else ConversationState()
        text = payload.text.strip()
        compact = re.sub(r"[\s,.!?。]", "", text)
        name = f"{user.name} 고객님" if user else "고객님"
        if not compact or compact in {"음성예약시작", "시작", "음성예약"} or any(w in compact for w in ("처음부터", "다시시작")):
            return ConversationOut(reply=f"안녕하세요, {name}. 어떤 여행 상품을 예약하시겠어요? 추천을 원하시면 '멋진 여행 추천해 주세요'라고 말씀해 주세요.", state=ConversationState())
        if "취소" in compact and not any(w in compact for w in ("커피", "샴페인", "와인", "케이크")):
            return ConversationOut(reply="예약 대화를 취소했어요. 실제 예약은 생성되지 않았어요. 다시 시작할 수 있어요.", state=ConversationState())
        if any(a.qty > 20 for a in state.addons):
            state.addons = [a for a in state.addons if a.qty <= 20]
            state.stage = "options"
            return ConversationOut(reply="식사 추가옵션은 한 종류당 20개 이내로 선택해 주세요. 필요한 수량을 다시 말씀해 주세요.", state=state)
        try:
            parsed = self.parser.parse(text, today)
        except (ValueError, OverflowError):
            return ConversationOut(reply="조건을 짧게 다시 말씀해 주세요. 예를 들어 '허니문 2명, 프리미엄 스타일'처럼 말씀하시면 돼요.", state=state)
        old_theme = state.theme_slug
        if any(w in compact for w in ("결혼", "혼인", "신혼", "허니문", "웨딩")):
            parsed.theme_slug = "honeymoon"
        if "프리미어" in compact:
            parsed.style_code = "premium"
        try:
            desired = self._date(text, today)
            if state.desired_date:
                date.fromisoformat(state.desired_date)
        except ValueError:
            state.desired_date = None
            return ConversationOut(reply="날짜를 확인해 주세요. 예를 들어 '12월 24일 출발'처럼 말씀해 주세요.", state=state)
        if desired:
            if desired < today:
                return ConversationOut(reply="이미 지난 날짜예요. 앞으로 출발할 날짜를 말씀해 주세요.", state=state)
            state.desired_date = desired.isoformat()
        if parsed.region:
            state.region = parsed.region
            state.package_id = state.departure_id = None
        if parsed.theme_slug:
            state.theme_slug = parsed.theme_slug
            if old_theme != state.theme_slug:
                state.package_id = state.departure_id = None
                state.travelers_count = None
                state.style_code = None
                if not parsed.region:
                    state.region = None
        if parsed.travelers_count:
            if parsed.travelers_count > (2 if state.theme_slug == "honeymoon" else 10):
                return ConversationOut(reply="허니문은 최대 2명까지만 예약할 수 있어요." if state.theme_slug == "honeymoon" else "한 예약은 최대 10명까지 선택해 주세요.", state=state)
            state.travelers_count = parsed.travelers_count
        if state.theme_slug == "honeymoon" and (state.travelers_count or 2) > 2:
            state.travelers_count = 2
            return ConversationOut(reply="허니문은 2인 전용이에요. 2명으로 안내할게요.", state=state)
        if parsed.style_code:
            state.style_code = parsed.style_code
        addon_changed, addon_error = self._addons(text, state)
        if addon_error:
            return ConversationOut(reply=addon_error, state=state)
        if not state.theme_slug:
            if state.stage == "greeting" or "추천" in compact:
                state.stage = "occasion"
                reply = "어떤 기념일이나 여행 목적이 있으세요? 결혼, 부모님 여행, 골프, 트레킹처럼 말씀해 주세요."
            else:
                reply = "허니문 낭만 투어, 효도 힐링 투어, 골프 챌린지 투어, 아웃도어 트레킹 투어 중 어떤 여행이 좋으세요?"
            return ConversationOut(reply=reply, state=state)
        if any(w in compact for w in ("결혼", "혼인", "웨딩")) and not any(w in compact for w in ("허니문", "신혼여행")):
            state.stage = "theme"
            return ConversationOut(reply="정말 축하드려요! 허니문 낭만 투어 또는 아웃도어 트레킹 투어는 어떠세요? 마음에 드는 테마를 말씀해 주세요.", state=state)
        if not state.style_code:
            if state.stage == "style" and self._yes(compact):
                state.style_code = "premium"
            else:
                state.stage = "style"
                package, _, packages = self._selection(state, today)
                if package is None:
                    return ConversationOut(reply="선택하신 조건에 예약 가능한 상품이 없어요. 다른 지역이나 테마를 말씀해 주세요.", state=state)
                return ConversationOut(reply=f"{package.theme.name}, 알겠습니다. 스타일은 프리미엄이 어떠세요? 그랜드나 클래식도 말씀하실 수 있어요.", state=state, packages=package_cards(self.db, packages[:6]))
        previous_selection = (state.package_id, state.departure_id, state.quoted_total, state.quoted_deposit)
        req, summary, packages = self._summary(state, user, today)
        cards = package_cards(self.db, packages[:6])
        if req is None:
            state.stage = "style" if "스타일" in summary else "options"
            return ConversationOut(reply=summary, state=state, packages=cards)
        changed = bool(parsed.theme_slug or parsed.style_code or parsed.travelers_count or parsed.region or desired or addon_changed)
        current_selection = (state.package_id, state.departure_id, state.quoted_total, state.quoted_deposit)
        if state.stage in {"confirm", "additional", "ready"} and previous_selection[0] is not None and previous_selection != current_selection:
            state.stage = "confirm"
            return ConversationOut(reply=summary + " 가능한 일정이나 금액이 변경되었어요. 새 조건이 맞으면 '맞아요'라고 말씀해 주세요.", state=state, packages=cards, booking_options=req)
        if state.stage == "additional" and self._no_more(compact) and not changed:
            state.stage = "ready"
            return ConversationOut(reply=summary + " 선택을 마쳤어요. 안내한 예약금으로 예약을 진행할게요.", state=state, packages=cards, ready_to_book=True, booking_options=req)
        if state.stage in {"options", "confirm"} and self._yes(compact) and not changed:
            state.stage = "additional"
            return ConversationOut(reply=summary + " 추가로 필요하신 것 있으세요? 없으면 '없어요'라고 말씀해 주세요.", state=state, packages=cards, booking_options=req)
        if state.stage == "ready" and not changed:
            return ConversationOut(reply=summary + " 아래 예약 확정 버튼을 눌러 주세요. 수정할 내용도 말씀하실 수 있어요.", state=state, packages=cards, ready_to_book=True, booking_options=req)
        state.stage = "confirm" if addon_changed else "options"
        return ConversationOut(reply=summary + " 맞으면 '맞아요'라고 말씀해 주세요. 커피 한 포트, 샴페인 한 병 같은 추가옵션도 말씀하실 수 있어요.", state=state, packages=cards, booking_options=req)
