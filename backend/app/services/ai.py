"""AI 컨시어지. 기본은 한국어 키워드 사전 기반 규칙 파서.
AI_PROVIDER=openai|anthropic 이고 키가 있으면 /ai/chat 답변만 LLM 으로 생성하고, 실패 시 규칙 답변으로 폴백한다.

클래스
- QueryParser: 자연어 → 검색 조건(ParsedQuery). 테마·지역·시기·인원·스타일·예산 키워드 사전 기반.
- IntentDetector: 발화 + 현재 화면(context) → 의도(intent)와 슬롯(IntentSlots).
- PackageMatcher: ParsedQuery 조건으로 공개 상품을 고른다 (좁으면 테마만으로 재검색).
- AIService (Facade): /ai/parse, /ai/chat 진입점. 위 셋과 LLM 호출(_llm_reply, 인프라)을 조합한다.
- ParsedQuery: 파싱 결과 값 객체.
기존 모듈 함수(parse_text, detect_intent, match_packages, parse, chat)는 호환용 얇은 래퍼다.
"""
import calendar
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Package, Theme
from app.schemas.ai import AIParseResult, ChatMessage, IntentSlots
from app.schemas.package import PackageCard
from app.services import pricing
from app.services.presenters import package_cards

logger = logging.getLogger("mrworld.ai")

THEME_KEYWORDS: dict[str, list[str]] = {
    "honeymoon": ["허니문", "신혼", "커플", "둘이", "로맨틱", "신혼여행", "웨딩"],
    "parents": ["부모님", "효도", "어르신", "엄마", "아빠", "어머니", "아버지", "장인", "장모", "시부모"],
    "golf": ["골프", "라운딩", "골프장", "홀"],
    "trekking": ["트레킹", "등산", "하이킹", "종주", "산행", "트래킹"],
}
THEME_NAMES: dict[str, str] = {"honeymoon": "허니문", "parents": "효도", "golf": "골프", "trekking": "트레킹"}

# 입력 키워드 -> (표시용 지역명, 상품 title/region/country 에서 찾을 토큰들)
REGION_KEYWORDS: dict[str, tuple[str, list[str]]] = {
    "발리": ("발리", ["발리"]),
    "우붓": ("발리", ["발리"]),
    "산토리니": ("산토리니", ["산토리니"]),
    "그리스": ("산토리니", ["그리스"]),
    "제주": ("제주", ["제주"]),
    "규슈": ("규슈", ["규슈", "후쿠오카"]),
    "후쿠오카": ("규슈", ["후쿠오카"]),
    "벳부": ("규슈", ["벳부"]),
    "유후인": ("규슈", ["후쿠오카", "벳부"]),
    "장가계": ("장가계", ["장가계"]),
    "천문산": ("장가계", ["장가계", "천문산"]),
    "강원": ("강원", ["강원"]),
    "강릉": ("강원", ["강릉", "강원"]),
    "정선": ("강원", ["정선", "강원"]),
    "다낭": ("다낭", ["다낭"]),
    "베트남": ("다낭", ["베트남"]),
    "치앙마이": ("치앙마이", ["치앙마이"]),
    "태국": ("치앙마이", ["태국"]),
    "네팔": ("네팔", ["네팔", "포카라"]),
    "히말라야": ("네팔", ["히말라야", "포카라"]),
    "푼힐": ("네팔", ["푼힐", "포카라"]),
    "포카라": ("네팔", ["포카라"]),
    "지리산": ("지리산", ["지리산"]),
    "홋카이도": ("홋카이도", ["홋카이도"]),
    "다이세츠": ("홋카이도", ["홋카이도"]),
    "일본": ("일본", ["일본"]),
    "중국": ("중국", ["중국"]),
    "국내": ("대한민국", ["대한민국"]),
    "인도네시아": ("발리", ["인도네시아"]),
}

STYLE_KEYWORDS: dict[str, list[str]] = {
    "premium": ["프리미엄", "고급", "럭셔리", "5성", "최고급", "하이엔드"],
    "grand": ["그랜드", "4성", "표준", "스탠다드"],
    "classic": ["가성비", "저렴", "클래식", "실속", "알뜰", "3성", "싸게", "저가"],
}

SEASONS: dict[str, tuple[int, int]] = {"봄": (3, 5), "여름": (6, 8), "가을": (9, 11), "겨울": (12, 2)}

KOREAN_COUNTS: dict[str, int] = {"혼자": 1, "둘이": 2, "두명": 2, "둘": 2, "셋이": 3, "세명": 3, "넷이": 4, "네명": 4, "다섯": 5, "여섯": 6}

_MONTH_RE = re.compile(r"(\d{1,2})\s*월")
_PEOPLE_RE = re.compile(r"(\d{1,2})\s*(?:명|인|사람)")
_BUDGET_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(만\s*원?|만)")
_BUDGET_WON_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d{6,})\s*원")


@dataclass
class ParsedQuery:
    """자연어에서 뽑아낸 검색 조건. 잡힌 키워드 원문은 keywords 에 순서대로 쌓인다."""

    theme_slug: str | None = None
    region: str | None = None
    region_tokens: list[str] = field(default_factory=list)
    depart_from: date | None = None
    depart_to: date | None = None
    travelers_count: int | None = None
    style_code: str | None = None
    budget_max: int | None = None
    keywords: list[str] = field(default_factory=list)


def _month_range(year: int, month: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def _first_hit(compact: str, words: list[str]) -> str | None:
    return next((w for w in words if w in compact), None)


class QueryParser:
    """자연어 → ParsedQuery. 상태가 없으며 today 는 테스트를 위해 주입할 수 있다."""

    def _parse_period(self, text: str, today: date, parsed: ParsedQuery) -> None:
        """다음 달/이번 달/N월/계절 표현을 출발 기간(depart_from~depart_to)으로 바꾼다."""
        if "다음 달" in text or "다음달" in text or "내달" in text:
            y, m = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
            parsed.depart_from, parsed.depart_to = _month_range(y, m)
            parsed.keywords.append("다음 달")
            return
        if "이번 달" in text or "이번달" in text:
            parsed.depart_from, parsed.depart_to = today, _month_range(today.year, today.month)[1]
            parsed.keywords.append("이번 달")
            return
        m = _MONTH_RE.search(text)
        if m and 1 <= int(m.group(1)) <= 12:
            month = int(m.group(1))
            year = today.year if month >= today.month else today.year + 1
            if "내년" in text:
                year = today.year + 1
            parsed.depart_from, parsed.depart_to = _month_range(year, month)
            parsed.keywords.append(f"{month}월")
            return
        for name, (start_m, end_m) in SEASONS.items():
            if name in text:
                year = today.year
                if start_m <= end_m:
                    if end_m < today.month:
                        year += 1
                    parsed.depart_from = _month_range(year, start_m)[0]
                    parsed.depart_to = _month_range(year, end_m)[1]
                else:  # 겨울: 12월 ~ 이듬해 2월. 1~2월이면 진행 중인 겨울을 가리킨다.
                    start_year = year - 1 if today.month <= 2 else year
                    parsed.depart_from = _month_range(start_year, start_m)[0]
                    parsed.depart_to = _month_range(start_year + 1, end_m)[1]
                parsed.keywords.append(name)
                return

    def _parse_travelers(self, text: str, parsed: ParsedQuery) -> None:
        """숫자+명/인, 한국어 수사(둘이·셋이), '부모님이랑'(본인 + 두 분) 을 인원으로 바꾼다."""
        m = _PEOPLE_RE.search(text)
        if m:
            parsed.travelers_count = int(m.group(1))
            parsed.keywords.append(f"{parsed.travelers_count}명")
            return
        for word, count in KOREAN_COUNTS.items():
            if word in text:
                parsed.travelers_count = count
                parsed.keywords.append(word)
                return
        if "부모님이랑" in text or "부모님과" in text or "부모님 모시고" in text:
            # 본인 + 부모님 두 분
            parsed.travelers_count = 3
            parsed.keywords.append("부모님과 3명")

    def _parse_budget(self, text: str, parsed: ParsedQuery) -> None:
        """'300만원', '2,500,000원' 표현을 1인 예산 상한(원)으로 바꾼다."""
        m = _BUDGET_RE.search(text)
        if m:
            amount = float(m.group(1).replace(",", ""))
            parsed.budget_max = int(amount * 10_000)
            parsed.keywords.append(f"{int(amount)}만원 이하")
            return
        m = _BUDGET_WON_RE.search(text)
        if m:
            parsed.budget_max = int(m.group(1).replace(",", ""))
            parsed.keywords.append(f"{parsed.budget_max:,}원 이하")

    def parse(self, text: str, today: date | None = None) -> ParsedQuery:
        """테마 → 지역(긴 키워드 우선) → 시기 → 인원 → 스타일 → 예산 순서로 조건을 뽑는다."""
        today = today or date.today()
        compact = text.replace(" ", "")
        parsed = ParsedQuery()

        for slug, words in THEME_KEYWORDS.items():
            hit = _first_hit(compact, words)
            if hit:
                parsed.theme_slug = slug
                parsed.keywords.append(hit)
                break

        # 긴 키워드 우선 (예: "지리산" 이 "산" 보다 먼저)
        for word in sorted(REGION_KEYWORDS, key=len, reverse=True):
            if word in compact:
                label, tokens = REGION_KEYWORDS[word]
                parsed.region = label
                parsed.region_tokens = tokens
                parsed.keywords.append(word)
                break

        self._parse_period(text, today, parsed)
        self._parse_travelers(text, parsed)

        for code, words in STYLE_KEYWORDS.items():
            hit = _first_hit(compact, words)
            if hit:
                parsed.style_code = code
                parsed.keywords.append(hit)
                break

        self._parse_budget(text, parsed)
        return parsed


class PackageMatcher:
    """ParsedQuery 조건 → 공개 상품 목록. 세션을 생성자로 받는다."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _matches(self, p: Package, parsed: ParsedQuery, today: date, strict: bool) -> bool:
        """strict 면 지역·스타일·예산·출발기간·인원까지 보고, 아니면 테마만 본다."""
        if parsed.theme_slug and p.theme.slug != parsed.theme_slug:
            return False
        if not strict:
            return True
        if parsed.region_tokens:
            haystack = f"{p.title} {p.region} {p.country}"
            if not any(tok in haystack for tok in parsed.region_tokens):
                return False
        if parsed.style_code and not (
            p.price_for(parsed.style_code) is not None and p.theme.allows_style(pricing.STYLES[parsed.style_code].rank)
        ):
            return False
        if parsed.budget_max is not None and p.from_price()[0] > parsed.budget_max:
            return False
        open_deps = [d for d in p.departures if d.is_bookable(today)]
        if parsed.depart_from and parsed.depart_to:
            open_deps = [d for d in open_deps if parsed.depart_from <= d.depart_date <= parsed.depart_to]
            if not open_deps:
                return False
        if parsed.travelers_count and open_deps and not any(d.capacity >= parsed.travelers_count for d in open_deps):
            return False
        return True

    def match(self, parsed: ParsedQuery, limit: int = 6) -> list[Package]:
        """규칙으로 상품을 고른다. 조건이 너무 좁아 0건이면 테마만으로 다시 찾는다. 리뷰 많은 순 → 최저가 순."""
        packages = self.db.scalars(select(Package).join(Theme).where(Package.is_published.is_(True), Theme.is_active.is_(True))).all()
        today = date.today()
        result = [p for p in packages if self._matches(p, parsed, today, strict=True)]
        if not result and (parsed.theme_slug or parsed.region_tokens):
            result = [p for p in packages if self._matches(p, parsed, today, strict=False)]
        result.sort(key=lambda p: (-p.review_count, p.from_price()[0]))
        return result[:limit]


# ---------- 음성/자연어 명령 의도

ORDINALS: dict[str, int] = {
    "첫번째": 1, "첫째": 1, "하나째": 1, "1번": 1, "일번": 1, "첫": 1,
    "두번째": 2, "둘째": 2, "2번": 2, "이번째": 2,
    "세번째": 3, "셋째": 3, "3번": 3, "삼번째": 3,
    "네번째": 4, "넷째": 4, "4번": 4, "사번째": 4,
    "다섯번째": 5, "5번": 5, "여섯번째": 6, "6번": 6,
    "마지막": -1,
}
HOTEL_WORDS: dict[str, int] = {"5성": 5, "오성": 5, "파이브스타": 5, "4성": 4, "사성": 4, "3성": 3, "삼성": 3}
MEAL_WORDS: dict[str, list[str]] = {
    "fine_dining": ["고급레스토랑", "스테이크", "샴페인", "파인다이닝", "고급식사"],
    "local": ["현지식", "현지레스토랑", "로컬"],
    "lunchbox": ["도시락", "간단히", "간단하게"],
}
BOOK_WORDS = ["예약해", "예약할게", "예약하기", "예약할래", "예약해줘", "예약진행", "예약하자", "결제할게", "결제하기"]
BACK_WORDS = ["뒤로", "이전으로", "이전화면", "돌아가", "취소해"]
HOME_WORDS = ["홈으로", "처음으로", "메인으로", "홈화면"]
MYBOOK_WORDS = ["내예약", "예약확인", "예약내역", "마이페이지", "지난여행", "예약목록"]
HELP_WORDS = ["뭐할수있", "도움말", "어떻게말", "사용법", "뭐라고말"]
_DATE_RE = re.compile(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일")
_DEPARTURE_HINT = ("출발", "떠나", "날짜", "일정")


class IntentDetector:
    """발화 + 현재 화면(context) → (intent, IntentSlots). 상태가 없다."""

    def _package_command(self, text: str, compact: str, parsed: ParsedQuery, slots: IntentSlots, today: date) -> str | None:
        """상품 상세 화면 조작: 출발일 → 호텔 → 식사 → 스타일 → 인원 순서로 본다. 해당 없으면 None."""
        m = _DATE_RE.search(text)
        if m and any(h in compact for h in _DEPARTURE_HINT):
            month, day = int(m.group(1)), int(m.group(2))
            year = today.year if (month, day) >= (today.month, today.day) else today.year + 1
            try:
                slots.depart_date = date(year, month, day).isoformat()
                return "set_departure"
            except ValueError:
                pass
        if any(h in compact for h in _DEPARTURE_HINT) and ("가장빠른" in compact or "제일빠른" in compact or "빠른날" in compact):
            slots.departure_pick = "earliest"
            return "set_departure"
        if any(h in compact for h in _DEPARTURE_HINT) and ("다음" in compact):
            slots.departure_pick = "next"
            return "set_departure"
        if any(h in compact for h in _DEPARTURE_HINT) and ("마지막" in compact):
            slots.departure_pick = "last"
            return "set_departure"
        for word, grade in HOTEL_WORDS.items():
            if word in compact and ("호텔" in compact or "숙소" in compact or "성급" in compact or "성으로" in compact):
                slots.hotel_grade = grade
                return "set_hotel"
        for code, words in MEAL_WORDS.items():
            if _first_hit(compact, words) and ("식사" in compact or "밥" in compact or "먹" in compact or "레스토랑" in compact or "도시락" in compact):
                slots.meal_code = code
                return "set_meal"
        if parsed.style_code and not parsed.theme_slug and not parsed.region:
            return "set_style"
        if parsed.travelers_count and not parsed.theme_slug and not parsed.region and ("명" in compact or "인원" in compact or "사람" in compact):
            return "set_travelers"
        return None

    def detect(self, text: str, parsed: ParsedQuery, context: str, today: date | None = None) -> tuple[str, IntentSlots]:
        """발화와 현재 화면으로 의도를 정한다. 검색 조건이 있으면 검색, 화면별 조작 명령이면 해당 의도.

        우선순위: 이동 명령(뒤로/홈/내 예약) → 예약 → n번째 선택 → 상세 화면 조작(스타일/인원/출발일/호텔/식사) → 검색.
        """
        today = today or date.today()
        compact = text.replace(" ", "")
        slots = IntentSlots()

        if _first_hit(compact, HELP_WORDS):
            return "help", slots
        if _first_hit(compact, MYBOOK_WORDS):
            return "my_bookings", slots
        if _first_hit(compact, HOME_WORDS):
            return "go_home", slots
        if _first_hit(compact, BACK_WORDS) and not parsed.theme_slug and not parsed.region:
            return "go_back", slots
        if _first_hit(compact, BOOK_WORDS) and context in ("package", "search", "theme"):
            return "book", slots

        # n번째 (목록·검색·테마 화면)
        if context in ("search", "theme", "home"):
            for word in sorted(ORDINALS, key=len, reverse=True):
                if word in compact and ("상품" in compact or "거" in compact or "번" in word or "째" in word or "마지막" in word):
                    slots.index = ORDINALS[word]
                    return "select_result", slots

        if context == "package":
            command = self._package_command(text, compact, parsed, slots, today)
            if command is not None:
                return command, slots

        if parsed.theme_slug or parsed.region or parsed.depart_from or parsed.travelers_count or parsed.style_code or parsed.budget_max:
            return "search", slots
        return "unknown", slots


# ---------- LLM 호출 (인프라). 키가 없거나 실패하면 None 을 돌려주고 규칙 답변으로 폴백한다.

def _llm_reply(messages: list[ChatMessage], result: AIParseResult, cards: list[PackageCard]) -> str | None:
    settings = get_settings()
    provider = settings.ai_provider.lower()
    if provider not in ("openai", "anthropic") or not settings.ai_api_key:
        return None
    catalog = "\n".join(f"- id {c.id}: {c.title} ({c.nights}박{c.days}일, 1인 {c.from_price:,}원부터)" for c in cards)
    system = (
        "당신은 여행사 '미스터 월드 테마 투어'의 상담사입니다. 한국어로 친근하고 간결하게, 이모지 없이 답합니다. "
        f"고객 요청 해석: {result.summary}. 추천 가능한 상품 목록:\n{catalog}\n목록에 없는 상품은 언급하지 않습니다."
    )
    history = [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")][-6:]
    try:
        with httpx.Client(timeout=15) as client:
            if provider == "openai":
                resp = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.ai_api_key}"},
                    json={"model": settings.ai_model or "gpt-4o-mini", "messages": [{"role": "system", "content": system}, *history], "max_tokens": 400},
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": settings.ai_api_key, "anthropic-version": "2023-06-01"},
                json={"model": settings.ai_model or "claude-3-5-haiku-latest", "system": system, "messages": history, "max_tokens": 400},
            )
            resp.raise_for_status()
            return "".join(block.get("text", "") for block in resp.json()["content"]).strip()
    except (httpx.HTTPError, KeyError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("LLM 호출 실패, 규칙 답변으로 폴백: %s", exc)
        return None


class AIService:
    """/ai/parse, /ai/chat 의 Facade. QueryParser·IntentDetector·PackageMatcher 를 조합하고 답변 문장을 만든다."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.parser = QueryParser()
        self.detector = IntentDetector()
        self.matcher = PackageMatcher(db)

    @staticmethod
    def summarize(parsed: ParsedQuery, theme_name: str | None) -> str:
        """ParsedQuery 를 사람이 읽는 한 줄 요약으로 ('허니문 · 발리 · 10월 · 2명')."""
        parts: list[str] = []
        if theme_name:
            parts.append(theme_name)
        if parsed.region:
            parts.append(parsed.region)
        if parsed.depart_from and parsed.depart_to:
            if parsed.depart_from.month == parsed.depart_to.month:
                parts.append(f"{parsed.depart_from.month}월")
            else:
                parts.append(f"{parsed.depart_from.month}월~{parsed.depart_to.month}월")
        if parsed.travelers_count:
            parts.append(f"{parsed.travelers_count}명")
        if parsed.style_code:
            parts.append(pricing.style_name(parsed.style_code))
        if parsed.budget_max:
            parts.append(f"1인 {parsed.budget_max // 10_000}만원 이하")
        return " · ".join(parts) if parts else "조건을 더 알려주시면 딱 맞는 상품을 찾아드릴게요"

    @staticmethod
    def intent_reply(intent: str, slots: IntentSlots, summary: str, parsed: ParsedQuery, matched_count: int) -> str:
        """의도별 확인 문장 ('그랜드 스타일로 바꿀까요?')."""
        if intent == "search":
            return f"{summary}(으)로 검색할까요?" if matched_count else f"{summary} 조건에 맞는 상품이 아직 없어요. 다른 조건으로 말씀해 주세요."
        if intent == "select_result":
            return "마지막 상품을 열까요?" if slots.index == -1 else f"{slots.index}번째 상품을 열까요?"
        if intent == "set_style":
            return f"{pricing.style_name(parsed.style_code)} 스타일로 바꿀까요?"
        if intent == "set_travelers":
            return f"인원을 {parsed.travelers_count}명으로 바꿀까요?"
        if intent == "set_departure":
            if slots.depart_date:
                d = date.fromisoformat(slots.depart_date)
                return f"{d.month}월 {d.day}일 출발로 바꿀까요?"
            return {"earliest": "가장 빠른 출발일로 바꿀까요?", "next": "다음 출발일로 바꿀까요?", "last": "마지막 출발일로 바꿀까요?"}[slots.departure_pick or "earliest"]
        if intent == "set_hotel":
            return f"호텔을 {slots.hotel_grade}성급으로 바꿀까요?"
        if intent == "set_meal":
            return f"식사를 {pricing.MEAL_OPTIONS[slots.meal_code][0]}(으)로 바꿀까요?"
        if intent == "book":
            return "지금 조건으로 예약을 진행할까요?"
        if intent == "go_back":
            return "이전 화면으로 돌아갈게요."
        if intent == "go_home":
            return "홈으로 이동할게요."
        if intent == "my_bookings":
            return "내 예약으로 이동할게요."
        if intent == "help":
            return "이렇게 말해 보세요. \"부모님이랑 10월에 온천\", \"두 번째 상품\", \"그랜드로 바꿔\", \"3명으로\", \"예약해줘\""
        return "잘 알아듣지 못했어요. 테마, 지역, 시기, 인원을 넣어 다시 말씀해 주세요."

    def parse(self, text: str, context: str = "home") -> tuple[AIParseResult, list[Package]]:
        """발화 → (파싱 결과 + 의도 + 답변, 매칭된 상품). 검색 의도일 때만 상품을 찾는다."""
        parsed = self.parser.parse(text)
        intent, slots = self.detector.detect(text, parsed, context)
        matched = self.matcher.match(parsed) if intent == "search" else []
        theme_name = matched[0].theme.name if matched and parsed.theme_slug else None
        if parsed.theme_slug and theme_name is None:
            theme_name = THEME_NAMES.get(parsed.theme_slug)
        summary = self.summarize(parsed, theme_name)
        result = AIParseResult(
            theme_slug=parsed.theme_slug,
            region=parsed.region,
            depart_from=parsed.depart_from.isoformat() if parsed.depart_from else None,
            depart_to=parsed.depart_to.isoformat() if parsed.depart_to else None,
            travelers_count=parsed.travelers_count,
            style_code=parsed.style_code,
            budget_max=parsed.budget_max,
            keywords=parsed.keywords,
            summary=summary,
            matched_package_ids=[p.id for p in matched],
            intent=intent,
            slots=slots,
            reply=self.intent_reply(intent, slots, summary, parsed, len(matched)),
        )
        return result, matched

    @staticmethod
    def _rule_reply(result: AIParseResult, cards: list[PackageCard]) -> str:
        """LLM 없이 만드는 채팅 답변: 요약 + 상위 3개 상품 소개."""
        if not cards:
            return (
                "말씀하신 조건에 딱 맞는 상품을 아직 찾지 못했어요. "
                "테마(허니문·효도·골프·트레킹), 가고 싶은 지역, 출발 시기, 인원을 알려주시면 다시 찾아볼게요."
            )
        intro = f"{result.summary} 조건으로 찾아봤어요." if result.keywords else "요즘 많이 찾으시는 상품으로 골라봤어요."
        lines = [intro]
        for c in cards[:3]:
            dep = f", 가장 빠른 출발 {c.next_departure.depart_date.month}/{c.next_departure.depart_date.day}" if c.next_departure else ""
            lines.append(f"- {c.title} ({c.nights}박 {c.days}일, 1인 {c.from_price:,}원부터{dep})")
        if len(cards) > 3:
            lines.append(f"이 외에도 {len(cards) - 3}개 상품이 더 있어요.")
        lines.append("마음에 드는 상품을 눌러 일정과 스타일별 가격을 확인해 보세요. 인원이나 예산을 알려주시면 더 좁혀드릴게요.")
        return "\n".join(lines)

    def chat(self, messages: list[ChatMessage]) -> tuple[str, list[PackageCard]]:
        """마지막 사용자 발화를 파싱해 상품 카드와 답변(LLM 우선, 실패 시 규칙)을 만든다."""
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        result, matched = self.parse(last_user)
        cards = package_cards(self.db, matched)
        reply = _llm_reply(messages, result, cards) or self._rule_reply(result, cards)
        return reply, cards


# ---------- 호환 래퍼 (테스트·기존 호출부용). 규칙은 위 클래스에만 있다.

def parse_text(text: str, today: date | None = None) -> ParsedQuery:
    return QueryParser().parse(text, today)


def detect_intent(text: str, parsed: ParsedQuery, context: str, today: date | None = None) -> tuple[str, IntentSlots]:
    return IntentDetector().detect(text, parsed, context, today)


def match_packages(db: Session, parsed: ParsedQuery, limit: int = 6) -> list[Package]:
    return PackageMatcher(db).match(parsed, limit)


def parse(db: Session, text: str, context: str = "home") -> tuple[AIParseResult, list[Package]]:
    return AIService(db).parse(text, context)


def chat(db: Session, messages: list[ChatMessage]) -> tuple[str, list[PackageCard]]:
    return AIService(db).chat(messages)
