from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    user_id: int
    user_name: str
    channel: Literal["sms"]
    template: str
    title: str
    body: str
    status: Literal["queued", "sent", "failed"]
    created_at: datetime
    sent_at: datetime | None
    provider: str | None = None
    to: str | None = None
    error: str | None = None


class SmsProviderStatus(BaseModel):
    provider: Literal["console", "solapi"]
    requested: str
    configured: bool
    sender: str | None
    live: bool


class SmsTestIn(BaseModel):
    phone: str
    body: str = "미스터 월드 문자 발송 테스트입니다."
