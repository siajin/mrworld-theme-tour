"""가격 엔진 (api-contract.md §3 의 공식을 그대로 구현, 정수 원·절사).

클래스
- PricingEngine: 가격 공식 계산과 옵션 규칙(스타일·호텔·식사·차량 정원) 검증, 카탈로그 상수 제공.
- PricingInput / AddonLine / Quote(스키마): 엔진의 입력·출력 값 객체.
- PricingCatalog: 스타일·호텔·식사·차량 옵션 목록 (카탈로그 응답용 값 객체).
모듈 상수(STYLES, HOTEL_GRADES …)는 정책표이며, 기존 모듈 함수는 호환용 얇은 래퍼다.

    style_price      = package_style_prices[style].price                 # 1인
    hotel_delta      = (hotel_surcharge[hotel_grade] - hotel_surcharge[style.default_hotel]) * nights
    meal_delta       = (meal_surcharge[meal_code]   - meal_surcharge[style.default_meal])   * days
    per_person       = style_price + hotel_delta + meal_delta
    subtotal         = per_person * travelers_count
    transport_total  = transport_surcharge[transport_code]                # 예약 1건당
    addons_total     = Σ addon.price * addon.qty * travelers_count        # 1인당·1회
    discount         = floor((subtotal + transport_total + addons_total) * loyalty_rate)
    total            = subtotal + transport_total + addons_total - discount
    deposit          = floor(total * deposit_rate / 1000) * 1000
"""
from dataclasses import dataclass
from math import floor

from fastapi import HTTPException, status

from app.schemas.booking import Quote, QuoteLine, QuoteResolved
from app.schemas.catalog import HotelGradeOut, MealOptionOut, StyleOut, TransportOptionOut


@dataclass(frozen=True)
class Style:
    """여행 스타일 정책값: 등급(rank)과 기본 호텔·식사."""

    code: str
    name: str
    rank: int
    hotel_grade: int
    meal_code: str
    description: str


STYLES: dict[str, Style] = {
    "classic": Style("classic", "클래식", 1, 3, "lunchbox", "3성급 호텔, 도시락 식사. 알차게 다니는 실속형"),
    "grand": Style("grand", "그랜드", 2, 4, "local", "4성급 호텔, 현지식 레스토랑. 가장 많이 선택하는 표준형"),
    "premium": Style("premium", "프리미엄", 3, 5, "fine_dining", "5성급 호텔, 고급 레스토랑 스테이크와 샴페인"),
}

HOTEL_GRADES: dict[int, tuple[str, int]] = {  # grade -> (label, 1인·1박 추가금)
    3: ("3성급", 0),
    4: ("4성급", 60_000),
    5: ("5성급", 150_000),
}

MEAL_OPTIONS: dict[str, tuple[str, int, str]] = {  # code -> (label, 1인·1일 추가금, description)
    "lunchbox": ("도시락", 0, "이동 중 간편하게 먹는 도시락"),
    "local": ("현지식 레스토랑", 25_000, "현지 맛집과 호텔 레스토랑 위주"),
    "fine_dining": ("고급 레스토랑", 90_000, "스테이크 코스와 샴페인이 포함된 파인 다이닝"),
}

TRANSPORT_OPTIONS: dict[str, tuple[str, int, int]] = {  # code -> (label, capacity, 예약당 추가금)
    "sedan_2": ("2인 전용 고급 세단", 2, 0),
    "van_10": ("10인승 고급 밴", 10, 0),
    "limousine": ("리무진", 4, 300_000),
    "premium_bus_25": ("25인승 프리미엄 버스", 25, 500_000),
}

STYLE_NAMES = {code: s.name for code, s in STYLES.items()}
MEAL_RANK = {"lunchbox": 1, "local": 2, "fine_dining": 3}


def style_name(code: str) -> str:
    """스타일 코드 → 표시 이름 (모르는 코드는 그대로)."""
    return STYLE_NAMES.get(code, code)


def min_style_for_theme(theme_min_style_rank: int) -> Style:
    """테마가 허용하는 가장 낮은 스타일. 세부 변경(호텔·식사)도 이 스타일의 기본값 아래로는 내려갈 수 없다."""
    return next((s for s in STYLES.values() if s.rank == theme_min_style_rank), STYLES["classic"])


@dataclass(frozen=True)
class AddonLine:
    """견적에 포함되는 추가옵션 1줄 (1인당·1회 단가)."""

    meal_addon_id: int
    label: str
    unit_price: int
    qty: int


@dataclass(frozen=True)
class PricingInput:
    """가격 계산에 필요한 값 전부 (ORM 과 무관한 순수 입력)."""

    style_code: str
    style_price: int  # 해당 패키지·스타일 1인 가격
    nights: int
    days: int
    travelers_count: int
    theme_min_style_rank: int
    theme_default_transport: str
    hotel_grade: int | None = None
    meal_code: str | None = None
    transport_code: str | None = None
    addons: tuple[AddonLine, ...] = ()
    loyalty_rate: float = 0.0
    deposit_rate: float = 0.1


@dataclass(frozen=True)
class PricingCatalog:
    """고객 화면에 보여 줄 선택지 목록 (정책표를 응답 스키마로 변환한 것)."""

    styles: list[StyleOut]
    hotel_grades: list[HotelGradeOut]
    meal_options: list[MealOptionOut]
    transport_options: list[TransportOptionOut]


def _bad_request(msg: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)


class PricingEngine:
    """가격 공식·옵션 규칙 검증. 상태가 없으므로 어디서든 PricingEngine() 으로 만들어 쓴다."""

    def validate_style_for_theme(self, style_code: str, theme_min_style_rank: int) -> Style:
        """스타일이 존재하고 테마 최소 등급 이상인지 검사해 Style 을 돌려준다 (위반 시 400)."""
        style = STYLES.get(style_code)
        if style is None:
            raise _bad_request("알 수 없는 스타일이에요")
        if style.rank < theme_min_style_rank:
            raise _bad_request("이 테마는 그랜드 스타일 이상만 선택할 수 있어요")
        return style

    def validate_options_for_theme(self, hotel_grade: int, meal_code: str, theme_min_style_rank: int) -> None:
        """호텔·식사 세부 변경이 테마 최소 스타일의 기본값 아래로 내려가지 않는지 검사한다 (위반 시 400)."""
        floor_style = min_style_for_theme(theme_min_style_rank)
        if hotel_grade < floor_style.hotel_grade:
            raise _bad_request(f"이 테마는 {floor_style.hotel_grade}성급 이상 호텔만 선택할 수 있어요")
        if MEAL_RANK[meal_code] < MEAL_RANK[floor_style.meal_code]:
            raise _bad_request(f"이 테마는 {MEAL_OPTIONS[floor_style.meal_code][0]} 이상 식사만 선택할 수 있어요")

    def validate_transport_capacity(self, transport_code: str, travelers_count: int) -> None:
        """인원이 차량 정원을 넘지 않는지 검사한다 (위반 시 400)."""
        label, capacity, _fee = TRANSPORT_OPTIONS[transport_code]
        if travelers_count > capacity:
            raise _bad_request(f"{label}은 최대 {capacity}명까지 탈 수 있어요. 인원에 맞는 차량을 골라 주세요")

    def calculate(self, inp: PricingInput) -> Quote:
        """모든 규칙을 검증한 뒤 공식대로 견적(Quote)을 계산한다."""
        style = self.validate_style_for_theme(inp.style_code, inp.theme_min_style_rank)

        hotel_grade = inp.hotel_grade if inp.hotel_grade is not None else style.hotel_grade
        meal_code = inp.meal_code or style.meal_code
        transport_code = inp.transport_code or inp.theme_default_transport
        if hotel_grade not in HOTEL_GRADES:
            raise _bad_request("호텔 등급은 3성·4성·5성 중에서 선택해 주세요")
        if meal_code not in MEAL_OPTIONS:
            raise _bad_request("식사 옵션은 도시락·현지식·고급 레스토랑 중에서 선택해 주세요")
        if transport_code not in TRANSPORT_OPTIONS:
            raise _bad_request("알 수 없는 차량 옵션이에요")
        if inp.travelers_count < 1:
            raise _bad_request("인원은 1명 이상이어야 해요")
        # 세부 변경도 테마 최소 스타일 아래로는 내려갈 수 없다 (허니문·효도: 4성·현지식 이상)
        self.validate_options_for_theme(hotel_grade, meal_code, inp.theme_min_style_rank)
        # 차량 정원을 넘는 인원은 예약할 수 없다 (허니문 2인 세단에 3명 등)
        self.validate_transport_capacity(transport_code, inp.travelers_count)

        n = inp.travelers_count
        hotel_delta = (HOTEL_GRADES[hotel_grade][1] - HOTEL_GRADES[style.hotel_grade][1]) * inp.nights
        meal_delta = (MEAL_OPTIONS[meal_code][1] - MEAL_OPTIONS[style.meal_code][1]) * inp.days
        per_person = inp.style_price + hotel_delta + meal_delta
        if per_person < 0:
            raise _bad_request("옵션 변경 후 여행 가격이 음수가 될 수 없어요. 상품 가격을 확인해 주세요")
        subtotal = per_person * n
        transport_total = TRANSPORT_OPTIONS[transport_code][2]
        addons_total = sum(a.unit_price * a.qty * n for a in inp.addons)
        gross = subtotal + transport_total + addons_total
        discount = floor(gross * inp.loyalty_rate)
        total = gross - discount
        deposit = floor(total * inp.deposit_rate / 1000) * 1000

        lines: list[QuoteLine] = [QuoteLine(label=f"{style.name} 스타일 {inp.style_price:,}원 × {n}명", amount=inp.style_price * n)]
        if hotel_delta:
            lines.append(QuoteLine(label=f"호텔 {HOTEL_GRADES[hotel_grade][0]} 변경 ({inp.nights}박 × {n}명)", amount=hotel_delta * n))
        if meal_delta:
            lines.append(QuoteLine(label=f"식사 {MEAL_OPTIONS[meal_code][0]} 변경 ({inp.days}일 × {n}명)", amount=meal_delta * n))
        if transport_total:
            lines.append(QuoteLine(label=f"차량 {TRANSPORT_OPTIONS[transport_code][0]}", amount=transport_total))
        for a in inp.addons:
            lines.append(QuoteLine(label=f"{a.label} × {a.qty} × {n}명", amount=a.unit_price * a.qty * n))
        if discount:
            lines.append(QuoteLine(label=f"단골 할인 {int(round(inp.loyalty_rate * 100))}%", amount=-discount))

        return Quote(
            per_person=per_person,
            style_price=inp.style_price,
            hotel_delta=hotel_delta,
            meal_delta=meal_delta,
            subtotal=subtotal,
            transport_total=transport_total,
            addons_total=addons_total,
            discount=discount,
            discount_rate=inp.loyalty_rate,
            total=total,
            deposit=deposit,
            travelers_count=n,
            resolved=QuoteResolved(hotel_grade=hotel_grade, meal_code=meal_code, transport_code=transport_code),
            lines=lines,
        )

    def catalog(self) -> PricingCatalog:
        """정책표(스타일·호텔·식사·차량)를 응답 스키마 목록으로 변환한다."""
        return PricingCatalog(
            styles=[
                StyleOut(code=s.code, name=s.name, rank=s.rank, hotel_grade=s.hotel_grade, meal_code=s.meal_code, description=s.description)
                for s in STYLES.values()
            ],
            hotel_grades=[HotelGradeOut(grade=g, label=label, surcharge=fee) for g, (label, fee) in HOTEL_GRADES.items()],
            meal_options=[MealOptionOut(code=c, label=label, surcharge=fee, description=desc) for c, (label, fee, desc) in MEAL_OPTIONS.items()],
            transport_options=[
                TransportOptionOut(code=c, label=label, capacity=cap, surcharge=fee) for c, (label, cap, fee) in TRANSPORT_OPTIONS.items()
            ],
        )


# ---------- 호환 래퍼 (테스트·기존 호출부용). 규칙은 PricingEngine 에만 있다.

def validate_style_for_theme(style_code: str, theme_min_style_rank: int) -> Style:
    return PricingEngine().validate_style_for_theme(style_code, theme_min_style_rank)


def validate_options_for_theme(hotel_grade: int, meal_code: str, theme_min_style_rank: int) -> None:
    PricingEngine().validate_options_for_theme(hotel_grade, meal_code, theme_min_style_rank)


def validate_transport_capacity(transport_code: str, travelers_count: int) -> None:
    PricingEngine().validate_transport_capacity(transport_code, travelers_count)


def calculate(inp: PricingInput) -> Quote:
    return PricingEngine().calculate(inp)


def catalog_styles() -> list[StyleOut]:
    return PricingEngine().catalog().styles


def catalog_hotel_grades() -> list[HotelGradeOut]:
    return PricingEngine().catalog().hotel_grades


def catalog_meal_options() -> list[MealOptionOut]:
    return PricingEngine().catalog().meal_options


def catalog_transport_options() -> list[TransportOptionOut]:
    return PricingEngine().catalog().transport_options
