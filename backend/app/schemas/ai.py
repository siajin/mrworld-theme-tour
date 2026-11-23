from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import StyleCode
from app.schemas.package import PackageCard
from app.schemas.booking import AddonIn, QuoteRequest


VoiceContext = Literal["home", "search", "theme", "package", "booking", "me", "other"]

# 음성/자연어 명령 의도. search 외에는 화면(context)에 따라 프론트가 실행한다.
Intent = Literal[
    "search",  # 조건으로 상품 검색
    "select_result",  # "첫 번째", "2번" → 목록에서 n번째 상품 열기
    "set_style",  # "그랜드로 바꿔"
    "set_travelers",  # "3명으로"
    "set_departure",  # "10월 12일 출발", "가장 빠른 날"
    "set_hotel",  # "호텔 5성으로"
    "set_meal",  # "식사는 고급 레스토랑으로"
    "book",  # "예약해줘"
    "go_back",
    "go_home",
    "my_bookings",
    "help",
    "unknown",
]


class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    context: VoiceContext = "home"  # 발화 당시 화면


class IntentSlots(BaseModel):
    index: int | None = None  # select_result: 1부터
    depart_date: str | None = None  # set_departure: YYYY-MM-DD
    departure_pick: Literal["earliest", "next", "last"] | None = None
    hotel_grade: int | None = None
    meal_code: str | None = None


class AIParseResult(BaseModel):
    theme_slug: str | None
    region: str | None
    depart_from: str | None
    depart_to: str | None
    travelers_count: int | None
    style_code: StyleCode | None
    budget_max: int | None
    keywords: list[str]
    summary: str
    matched_package_ids: list[int]
    intent: Intent = "search"
    slots: IntentSlots = Field(default_factory=IntentSlots)
    reply: str = ""  # 화면에 띄울 짧은 확인 문구 ("허니문 · 10월 · 2명으로 검색할까요?")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class ChatOut(BaseModel):
    reply: str
    packages: list[PackageCard]


class ConversationState(BaseModel):
    """화면에서 보관하는 예약 대화의 선택값. 실제 예약 권한이나 재고를 보장하지 않는다."""

    stage: Literal["greeting", "occasion", "theme", "style", "options", "confirm", "additional", "ready"] = "greeting"
    theme_slug: Literal["honeymoon", "parents", "golf", "trekking"] | None = None
    region: str | None = Field(default=None, max_length=100)
    desired_date: str | None = Field(default=None, max_length=10, pattern=r"^\d{4}-\d{2}-\d{2}$")
    travelers_count: int | None = Field(default=None, ge=1, le=25)
    style_code: StyleCode | None = None
    package_id: int | None = Field(default=None, ge=1)
    departure_id: int | None = Field(default=None, ge=1)
    addons: list[AddonIn] = Field(default_factory=list, max_length=10)
    quoted_total: int | None = Field(default=None, ge=0)
    quoted_deposit: int | None = Field(default=None, ge=0)


class ConversationIn(BaseModel):
    text: str = Field(default="", max_length=1000)
    state: ConversationState | None = None


class ConversationOut(BaseModel):
    reply: str
    state: ConversationState
    packages: list[PackageCard] = Field(default_factory=list)
    ready_to_book: bool = False
    booking_options: QuoteRequest | None = None
