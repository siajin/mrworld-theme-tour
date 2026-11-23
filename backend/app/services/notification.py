"""알림 서비스.

클래스
- NotificationService: 템플릿을 렌더링해 알림 행(notifications)을 만들고 SmsProvider 로 보낸다 (send, send_to_booking, send_to_phone, send_to_staff, send_test, resend).
- SmsProvider (Protocol): 발송 채널 전략 `send(phone, title, body) -> SendResult`.
  - ConsoleSmsProvider: 실제 발송 없이 DB 기록 + 콘솔 로그 (기본값, 키가 없을 때)
  - SolapiSmsProvider: CoolSMS(Solapi) REST API 로 실제 문자 발송. .env 의 SMS_PROVIDER=solapi,
    SOLAPI_API_KEY / SOLAPI_API_SECRET / SMS_FROM 세 값이 모두 있어야 켜진다.
- SendResult: provider 발송 결과 값 객체.
어느 provider 든 결과는 notifications 테이블에 남는다 (status sent|failed, payload.error 에 실패 사유).
"""
import hashlib
import hmac
import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Booking, Notification, User, now

logger = logging.getLogger("mrworld.sms")

SMS_MAX_BYTES = 90  # 통신사 단문(SMS) 한도. 한글 2바이트(EUC-KR) 기준 45자. 넘으면 LMS 로 나가 요금이 2.5배.

TEMPLATES: dict[str, tuple[str, str]] = {
    # template -> (title, body 포맷). title 은 로그·LMS 제목용이고, 본문은 90바이트 안에 들어오게 짧게 쓴다.
    "booking_confirmed": (
        "[미스터 월드] 예약 확정",
        "[미스터월드] {package_title} {depart_md} 출발 확정! 예약번호 {code}",
    ),
    "companion_joined": (
        "[미스터 월드] 동행 합류",
        "[미스터월드] {companion_name}님 합류. 현재 {travelers_count}명, {needed_more}명 더 모이면 확정 ({code})",
    ),
    "booking_cancelled": (
        "[미스터 월드] 예약 취소",
        "[미스터월드] {package_title} {depart_md} 예약 취소. 예약금 3영업일내 환불 {code}",
    ),
    "inventory_short": (
        "[미스터 월드] 재고 부족",
        "[미스터월드] {item_name} 재고부족. {code} 출고 {shortage}{unit} 미처리, 수동출고 요망",
    ),
    "booking_received": (
        "[미스터 월드] 예약 접수",
        "[미스터월드] {package_title} {depart_md} 예약 접수. {needed_more}명 더 모이면 확정. 초대코드 {invite_code}",
    ),
    "test": ("[미스터 월드] 발송 테스트", "[미스터월드] {body}"),
}


def sms_bytes(text: str) -> int:
    """통신사 기준(EUC-KR) 바이트 수. 인코딩 안 되는 문자는 2바이트로 센다."""
    total = 0
    for ch in text:
        try:
            total += len(ch.encode("euc-kr"))
        except UnicodeEncodeError:
            total += 2
    return total


def render_body(body_fmt: str, payload: dict[str, Any], max_bytes: int = SMS_MAX_BYTES) -> str:
    """본문을 렌더링하되 90바이트를 넘으면 상품명부터 줄여 단문(SMS) 안에 맞춘다."""
    body = body_fmt.format(**payload)
    if sms_bytes(body) <= max_bytes or "{package_title}" not in body_fmt:
        return body
    title = str(payload.get("package_title", ""))
    # "발리 우붓 & 스미냑 허니문 5일" → 뒤에서부터 단어를 떼어내며 맞춘다
    words = title.split()
    while len(words) > 1:
        words.pop()
        shortened = " ".join(words)
        body = body_fmt.format(**{**payload, "package_title": shortened})
        if sms_bytes(body) <= max_bytes:
            return body
    # 그래도 길면 글자 단위로 자른다
    while title and sms_bytes(body) > max_bytes:
        title = title[:-1]
        body = body_fmt.format(**{**payload, "package_title": title})
    return body


@dataclass
class SendResult:
    """provider 발송 결과 (성공 시각·실패 사유·외부 메시지 id)."""

    status: str  # sent | failed
    sent_at: datetime | None
    error: str | None = None
    provider_message_id: str | None = None


class SmsProvider(Protocol):
    """발송 채널 전략. 구현체는 이름(name)과 send 만 제공하면 된다."""

    name: str

    def send(self, phone: str, title: str, body: str) -> SendResult: ...


class ConsoleSmsProvider:
    """개발·테스트용: 발송 대신 로그만 남기고 항상 성공으로 처리한다."""

    name = "console"

    def send(self, phone: str, title: str, body: str) -> SendResult:
        logger.info("SMS -> %s | %s | %s", phone or "(번호 없음)", title, body)
        return SendResult(status="sent", sent_at=now())


def normalize_phone(phone: str) -> str:
    """'010-1234-5678' → '01012345678'. 국가번호 +82 는 0 으로 바꾼다."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("82") and len(digits) >= 11:
        digits = "0" + digits[2:]
    return digits


class SolapiSmsProvider:
    """CoolSMS(Solapi) v4. https://developers.solapi.com/references/messages/sendOne"""

    name = "solapi"
    endpoint = "https://api.solapi.com/messages/v4/send"

    def __init__(self, api_key: str, api_secret: str, sender: str, timeout: float = 10.0) -> None:
        self.api_key = api_key
        self.api_secret = api_secret
        self.sender = normalize_phone(sender)
        self.timeout = timeout

    def _auth_header(self) -> str:
        date = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        salt = secrets.token_hex(16)
        signature = hmac.new(self.api_secret.encode(), (date + salt).encode(), hashlib.sha256).hexdigest()
        return f"HMAC-SHA256 apiKey={self.api_key}, date={date}, salt={salt}, signature={signature}"

    def send(self, phone: str, title: str, body: str) -> SendResult:
        to = normalize_phone(phone)
        if not to:
            return SendResult(status="failed", sent_at=None, error="수신자 연락처가 없어요")
        message: dict[str, Any] = {"to": to, "from": self.sender, "text": body}
        if sms_bytes(body) > SMS_MAX_BYTES:  # 90바이트 초과면 LMS 로 나가므로 제목을 붙인다
            message["subject"] = title
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(self.endpoint, headers={"Authorization": self._auth_header()}, json={"message": message})
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400:
                err = data.get("errorMessage") or data.get("message") or f"HTTP {resp.status_code}"
                logger.warning("Solapi 발송 실패 -> %s: %s", to, err)
                return SendResult(status="failed", sent_at=None, error=str(err))
            logger.info("Solapi 발송 -> %s | %s | messageId=%s", to, title, data.get("messageId"))
            return SendResult(status="sent", sent_at=now(), provider_message_id=data.get("messageId"))
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Solapi 호출 오류 -> %s: %s", to, exc)
            return SendResult(status="failed", sent_at=None, error=str(exc))


def provider_status() -> dict[str, Any]:
    s = get_settings()
    configured = bool(s.solapi_api_key and s.solapi_api_secret and s.sms_from)
    active = s.sms_provider.lower() == "solapi" and configured
    sender = normalize_phone(s.sms_from)
    masked = f"{sender[:3]}-****-{sender[-4:]}" if len(sender) >= 9 else (sender or None)
    return {
        "provider": "solapi" if active else "console",
        "requested": s.sms_provider.lower(),
        "configured": configured,
        "sender": masked,
        "live": active,
    }


def get_provider() -> SmsProvider:
    s = get_settings()
    if s.sms_provider.lower() == "solapi":
        if s.solapi_api_key and s.solapi_api_secret and s.sms_from:
            return SolapiSmsProvider(s.solapi_api_key, s.solapi_api_secret, s.sms_from)
        logger.warning("SMS_PROVIDER=solapi 이지만 키/발신번호가 비어 있어 console 로 동작합니다.")
    return ConsoleSmsProvider()


class NotificationService:
    """알림 생성·발송. provider 를 주입하지 않으면 설정에 따라 고른다. 커밋은 호출자가 한다."""

    def __init__(self, db: Session, provider: SmsProvider | None = None) -> None:
        self.db = db
        self.provider = provider or get_provider()

    def _deliver(self, user_id: int, phone: str, template: str, title: str, body: str, payload: dict[str, Any]) -> Notification:
        result = self.provider.send(phone, title, body)
        meta = dict(payload)
        meta["provider"] = self.provider.name
        meta["to"] = normalize_phone(phone)
        if result.error:
            meta["error"] = result.error
        if result.provider_message_id:
            meta["provider_message_id"] = result.provider_message_id
        row = Notification(
            user_id=user_id,
            channel="sms",
            template=template,
            title=title,
            body=body,
            payload=meta,
            status=result.status,
            sent_at=result.sent_at,
        )
        self.db.add(row)
        return row

    def send(self, user_id: int, template: str, payload: dict[str, Any]) -> Notification:
        """템플릿을 렌더링해 알림 행을 만들고 provider 로 보낸다. 커밋은 호출자가 한다."""
        title_fmt, body_fmt = TEMPLATES[template]
        title = title_fmt.format(**payload)
        body = render_body(body_fmt, payload)
        user = self.db.get(User, user_id)
        return self._deliver(user_id, user.phone if user else "", template, title, body, payload)

    def send_to_phone(self, user_id: int, phone: str, template: str, payload: dict[str, Any]) -> Notification:
        """계정 번호 대신 지정한 번호로 보낸다 (예약 때 입력한 대표자 연락처 등)."""
        title_fmt, body_fmt = TEMPLATES[template]
        return self._deliver(user_id, phone, template, title_fmt.format(**payload), render_body(body_fmt, payload), payload)

    def send_to_booking(self, booking: Booking, template: str, payload: dict[str, Any]) -> list[Notification]:
        """예약의 모든 여행자(대표자 + 동행, 비회원 포함)에게 보낸다.

        번호는 예약 때 입력한 여행자 연락처를 우선 쓰고, 없으면 연결된 회원 계정의 연락처를 쓴다.
        같은 번호는 한 번만 보낸다. 기록의 user_id 는 연결된 회원, 비회원 동행은 대표자 계정으로 남긴다.
        """
        title_fmt, body_fmt = TEMPLATES[template]
        title = title_fmt.format(**payload)
        body = render_body(body_fmt, payload)
        rows: list[Notification] = []
        seen: set[str] = set()
        rep_user = self.db.get(User, booking.user_id)
        travelers = list(booking.travelers) or []
        for t in travelers:
            linked = self.db.get(User, t.user_id) if t.user_id else None
            phone = normalize_phone(t.phone or "") or normalize_phone((linked or (rep_user if t.is_representative else None) or User(phone="")).phone or "")
            if phone and phone in seen:
                continue
            if phone:
                seen.add(phone)
            user_id = t.user_id or booking.user_id
            rows.append(self._deliver(user_id, phone, template, title, body, {**payload, "recipient_name": t.name}))
        if not travelers:  # 여행자 정보가 없는 예외 상황: 대표자 계정 번호로
            rows.append(self._deliver(booking.user_id, rep_user.phone if rep_user else "", template, title, body, payload))
        return rows

    def send_to_staff(self, template: str, payload: dict[str, Any]) -> list[Notification]:
        """모든 직원 계정에 보낸다 (재고 부족 등 운영 알림)."""
        staff_ids = self.db.scalars(select(User.id).where(User.role == "staff")).all()
        return [self.send(uid, template, payload) for uid in staff_ids]

    def send_test(self, staff: User, phone: str, body: str) -> Notification:
        """직원 화면의 '테스트 발송'. 기록은 요청한 직원 계정에 남긴다."""
        title, body_fmt = TEMPLATES["test"]
        return self._deliver(staff.id, phone, "test", title, render_body(body_fmt, {"body": body}), {})

    def resend(self, notification: Notification) -> Notification:
        """실패한 알림을 같은 내용으로 다시 보낸다 (새 행으로 기록)."""
        user = self.db.get(User, notification.user_id)
        phone = (notification.payload or {}).get("to") or (user.phone if user else "")
        payload = {k: v for k, v in (notification.payload or {}).items() if k not in ("error", "provider", "provider_message_id", "to")}
        payload["resend_of"] = notification.id
        return self._deliver(notification.user_id, phone, notification.template, notification.title, notification.body, payload)
