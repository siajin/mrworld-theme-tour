"""시드 데이터. `python -m app.db.seed [--reset]`

- 멱등: 계정·물품·테마·상품은 자연키(email/sku/slug)로 upsert, 예약은 demo 계정에 예약이 없을 때만 넣는다.
- 결정적: 난수 없음. 출발일은 오늘 기준 상대 날짜로 계산한다.
"""
import argparse
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base, create_schema
from app.db.images import package_images, theme_image
from app.db.session import SessionLocal, engine
from app.models import (
    Booking,
    Departure,
    InventoryItem,
    InventoryMove,
    MealAddon,
    Package,
    PackageItinerary,
    Theme,
    ThemePerk,
    User,
)
from app.schemas.booking import BookingCreate, TravelerIn
from app.services import booking as booking_service
from app.services.app_settings import ensure_defaults
from app.services.notification import ConsoleSmsProvider, NotificationService
from app.services.inventory import InventoryService

# ---------------------------------------------------------------------------
# 계정
# ---------------------------------------------------------------------------

ACCOUNTS = [
    # email, password, role, name, phone, address
    ("admin@mrworld.com", "admin1234", "staff", "김운영", "02-555-0100", "서울 중구 을지로 100 미스터월드 본사"),
    ("demo@customer.com", "demo1234", "customer", "시아진", "010-2345-6789", "서울 동대문구 왕산로 200"),
    ("friend1@customer.com", "demo1234", "customer", "박동행", "010-3456-7890", "서울 성북구 보문로 12"),
    ("friend2@customer.com", "demo1234", "customer", "이서연", "010-4567-8901", "경기 성남시 분당구 판교역로 45"),
    ("minjun.choi@example.com", "demo1234", "customer", "최민준", "010-5678-9012", "부산 해운대구 마린시티2로 33"),
    ("jimin.han@example.com", "demo1234", "customer", "한지민", "010-6789-0123", "대구 수성구 동대구로 77"),
    ("sehun.oh@example.com", "demo1234", "customer", "오세훈", "010-7890-1234", "인천 연수구 송도과학로 16"),
]

# ---------------------------------------------------------------------------
# 창고 물품 / 테마
# ---------------------------------------------------------------------------

INVENTORY = [
    # sku, name, category, unit, stock, reorder_level
    ("CPL-TEE", "커플 기념티", "기념품", "장", 120, 30),
    ("GNS-GIFT", "건강 인삼 기념품", "기념품", "세트", 80, 20),
    ("GLF-BALL", "골프공 세트", "골프", "세트", 200, 40),
    ("GLF-ACC", "골프 액세서리", "골프", "세트", 60, 20),
    ("TRK-SCARF", "아웃도어 스카프", "기념품", "장", 150, 30),
    ("ROOM-DECO", "룸 데코 키트", "연출", "세트", 40, 10),
    ("MSG-VCHR", "안마·지압 이용권", "서비스", "매", 90, 20),
]

THEMES = [
    {
        "slug": "honeymoon",
        "name": "허니문 낭만 투어",
        "tagline": "둘만의 첫 여행, 공항 픽업부터 룸 데코까지 저희가 챙깁니다",
        "description": (
            "예식 준비로 지친 두 분을 위해 일정은 느긋하게, 숙소는 4성 이상 리조트만 골랐습니다. "
            "이동은 2인 전용 고급 세단으로 모시고, 체크인하는 날 객실에는 로맨틱 스페셜 룸 데코와 커플 기념티를 준비해 둡니다. "
            "허니문은 두 분만 예약하셔도 바로 출발이 확정됩니다."
        ),
        "icon": "heart",
        "hero_image": theme_image("honeymoon"),
        "min_style_rank": 2,
        "min_travelers": 2,
        "vehicle_label": "2인 전용 고급 세단",
        "default_transport": "sedan_2",
        "perks": [("커플 기념티", "CPL-TEE", 1, True), ("로맨틱 스페셜 룸 데코", "ROOM-DECO", 1, False)],
    },
    {
        "slug": "parents",
        "name": "효도 힐링 투어",
        "tagline": "부모님 걸음에 맞춘 여유 있는 일정, 온천과 휴식 시간을 넉넉히",
        "description": (
            "하루 관광지는 두세 곳으로 줄이고 오후에는 온천이나 휴식 시간을 넣었습니다. "
            "10인승 고급 밴으로 오르내리기 편하게 이동하고, 여행 중 안마·지압 서비스와 건강 인삼 기념품을 드립니다. "
            "부모님이 편히 쉬실 수 있도록 그랜드 스타일(4성) 이상으로만 운영합니다."
        ),
        "icon": "hand-heart",
        "hero_image": theme_image("parents"),
        "min_style_rank": 2,
        "min_travelers": 3,
        "vehicle_label": "10인승 고급 밴",
        "default_transport": "van_10",
        "perks": [("건강 인삼 기념품", "GNS-GIFT", 1, True), ("안마·지압 서비스 이용권", "MSG-VCHR", 1, True)],
    },
    {
        "slug": "golf",
        "name": "골프 챌린지 투어",
        "tagline": "명문 코스 라운딩, 골프백 운반과 티오프 예약은 저희가 합니다",
        "description": (
            "출발 전 티오프 시간을 확정해 드리고, 골프백은 공항에서 리조트까지 저희가 옮깁니다. "
            "라운딩 사이에는 마사지와 현지 식사를 넣어 무리하지 않게 짰고, 골프공 세트와 골프 액세서리를 기본으로 드립니다. "
            "3명 이상 모이면 출발이 확정되니 동행 초대 코드를 활용해 보세요."
        ),
        "icon": "flag",
        "hero_image": theme_image("golf"),
        "min_style_rank": 1,
        "min_travelers": 3,
        "vehicle_label": "10인승 고급 밴",
        "default_transport": "van_10",
        "perks": [("유명 골프 리조트 테마 연출", None, 1, False), ("골프공 세트", "GLF-BALL", 1, True), ("골프 액세서리", "GLF-ACC", 1, True)],
    },
    {
        "slug": "trekking",
        "name": "아웃도어 트레킹 투어",
        "tagline": "초보도 완주할 수 있는 코스만, 산악 가이드와 포터가 동행합니다",
        "description": (
            "하루 걷는 거리는 8~15km 안에서 잡고, 고도는 천천히 올립니다. "
            "현지 산악 가이드와 포터가 함께하며 대피소·롯지는 출발 확정 즉시 저희가 예약합니다. "
            "출발 전 준비물 안내서와 아웃도어 기념 스카프를 보내 드립니다."
        ),
        "icon": "mountain",
        "hero_image": theme_image("trekking"),
        "min_style_rank": 1,
        "min_travelers": 3,
        "vehicle_label": "10인승 고급 밴",
        "default_transport": "van_10",
        "perks": [("트레킹·산악 테마 어드벤처 연출", None, 1, False), ("아웃도어 기념 스카프", "TRK-SCARF", 1, True)],
    },
]

MEAL_ADDONS = [
    ("champagne", "샴페인 1병", 80_000),
    ("coffee", "스페셜티 커피", 12_000),
    ("wine_pairing", "와인 페어링", 65_000),
    ("cake", "생일·기념일 케이크", 45_000),
]

# ---------------------------------------------------------------------------
# 패키지
# ---------------------------------------------------------------------------

INCL_OVERSEAS = ["왕복 항공권", "제세공과금(유류할증료·공항세)", "여행자보험(최대 1억원)", "전용 차량", "관광지 입장료", "일정표에 표시된 식사", "스타일별 숙박"]
EXCL_OVERSEAS = ["가이드·기사 경비", "개인 경비", "싱글룸 사용료", "선택 관광", "매너팁"]
INCL_DOMESTIC = ["전용 차량", "여행자보험", "관광지 입장료", "일정표에 표시된 식사", "스타일별 숙박"]
EXCL_DOMESTIC = ["개인 경비", "싱글룸 사용료", "기사 경비", "선택 관광"]


def _day(day_no: int, title: str, places: list[str], meals: tuple[str, str, str], lodging: str, description: str) -> dict:
    return {
        "day_no": day_no,
        "title": title,
        "places": places,
        "breakfast": meals[0],
        "lunch": meals[1],
        "dinner": meals[2],
        "lodging": lodging,
        "description": description,
    }


@dataclass
class DepartureSpec:
    offset_days: int  # 오늘 기준 출발일
    capacity: int
    parties: list[int] = field(default_factory=list)  # 채워 넣을 다른 고객 예약(각 인원)


@dataclass
class PackageSpec:
    slug: str
    theme: str
    title: str
    subtitle: str
    region: str
    country: str
    nights: int
    days: int
    prices: dict[str, int]
    summary: str
    highlights: list[str]
    badges: list[str]
    rating: float
    review_count: int
    includes: list[str]
    excludes: list[str]
    notes: str
    itinerary: list[dict]
    departures: list[DepartureSpec]


PACKAGES: list[PackageSpec] = [
    PackageSpec(
        slug="bali-honeymoon",
        theme="honeymoon",
        title="발리 우붓 & 스미냑 허니문 5일",
        subtitle="우붓의 숲과 스미냑의 바다를 한 번에, 프라이빗 세단 이동",
        region="발리",
        country="인도네시아",
        nights=3,
        days=5,
        prices={"grand": 1_890_000, "premium": 2_690_000},
        summary="스미냑 리조트에 머물며 우붓과 울루와뚜를 하루씩 다녀오는 일정입니다. 커플 스파와 짐바란 선셋 디너가 들어 있습니다.",
        highlights=["뜨갈랄랑 라이스 테라스 & 우붓 몽키 포레스트", "울루와뚜 사원 케착댄스 관람", "짐바란 비치 선셋 씨푸드 디너", "2시간 커플 스파 포함"],
        badges=["인기"],
        rating=4.9,
        review_count=1184,
        includes=INCL_OVERSEAS + ["커플 스파 2시간 1회"],
        excludes=EXCL_OVERSEAS,
        notes="우기(11~3월)에는 오후 소나기가 잦아 우붓 일정은 오전에 진행합니다. 사원 방문 시 사롱은 현지에서 대여해 드립니다.",
        itinerary=[
            _day(1, "인천 출발, 스미냑 리조트 체크인", ["인천국제공항", "덴파사르 응우라라이 공항", "스미냑 비치"], ("-", "기내식", "스미냑 비치 씨푸드"), "스미냑 리조트", "직항으로 덴파사르 도착 후 전용 세단으로 스미냑 리조트로 이동합니다. 객실에는 룸 데코가 준비되어 있고, 저녁은 해변가 레스토랑에서 선셋을 보며 드십니다."),
            _day(2, "우붓 하루 여행", ["우붓 몽키 포레스트", "뜨갈랄랑 라이스 테라스", "우붓 왕궁", "우붓 시장", "캄푸한 릿지 워크"], ("호텔식", "떼갈랄랑 뷰 레스토랑", "우붓 현지식"), "스미냑 리조트", "오전에 몽키 포레스트와 라이스 테라스를 둘러보고, 점심 후 우붓 왕궁과 시장을 걷습니다. 해질 무렵 캄푸한 릿지 워크를 산책합니다."),
            _day(3, "울루와뚜 케착댄스와 짐바란 디너", ["커플 스파", "울루와뚜 사원", "짐바란 비치"], ("호텔식", "리조트 레스토랑", "짐바란 씨푸드 BBQ"), "스미냑 리조트", "오전은 리조트에서 휴식하며 커플 스파를 받습니다. 오후 늦게 울루와뚜 사원 절벽에서 케착댄스를 보고 짐바란 해변에서 저녁을 드십니다."),
            _day(4, "자유 일정 후 출발", ["스미냑 이트 스트리트", "포테이토 헤드 비치 클럽", "덴파사르 공항"], ("호텔식", "자유식", "기내식"), "기내", "체크아웃 후 짐은 저희가 보관합니다. 스미냑 거리와 비치 클럽에서 자유 시간을 보내고 밤 비행기로 출발합니다."),
            _day(5, "인천 도착", ["인천국제공항"], ("기내식", "-", "-"), "-", "오전 인천 도착 후 해산합니다."),
        ],
        departures=[DepartureSpec(18, 12, [2, 2, 2]), DepartureSpec(39, 12, [2, 2]), DepartureSpec(67, 16), DepartureSpec(102, 16, [2])],
    ),
    PackageSpec(
        slug="santorini-honeymoon",
        theme="honeymoon",
        title="산토리니 이아 선셋 허니문 7일",
        subtitle="칼데라 절벽 위 호텔에서 보내는 5박, 이아 선셋과 화산 크루즈",
        region="산토리니",
        country="그리스",
        nights=5,
        days=7,
        prices={"grand": 3_490_000, "premium": 4_590_000},
        summary="아테네를 거쳐 산토리니에 5박 머무는 일정입니다. 칼데라 뷰 객실, 이아 선셋, 화산 크루즈와 와이너리 방문이 포함됩니다.",
        highlights=["이아 마을 선셋 포인트", "네아 카메니 화산 & 온천 크루즈", "산토 와인즈 칼데라 뷰 시음", "피라~이메로비글리 칼데라 트레일 산책"],
        badges=["인기", "신규"],
        rating=4.8,
        review_count=412,
        includes=INCL_OVERSEAS + ["칼데라 크루즈 1회", "와이너리 시음 1회"],
        excludes=EXCL_OVERSEAS + ["아테네 경유 시 공항 라운지"],
        notes="산토리니 호텔은 계단이 많은 지형입니다. 캐리어 운반은 호텔 포터가 도와드립니다. 4~10월 출발만 운영합니다.",
        itinerary=[
            _day(1, "인천 출발, 아테네 경유 산토리니 도착", ["인천국제공항", "아테네 공항", "산토리니 공항", "피라"], ("-", "기내식", "피라 그릭 타베르나"), "피라 칼데라 뷰 호텔", "아테네에서 국내선으로 갈아타고 저녁 산토리니에 도착합니다. 전용 차량으로 피라 호텔에 체크인합니다."),
            _day(2, "이아 마을과 선셋", ["이아 마을", "아무디 베이", "이아 선셋 포인트"], ("호텔식", "아무디 베이 씨푸드", "이아 레스토랑"), "피라 칼데라 뷰 호텔", "이아 마을의 골목과 블루 돔 교회를 천천히 걷고, 아무디 베이로 내려가 점심을 드십니다. 해질 무렵 선셋 포인트에서 일몰을 봅니다."),
            _day(3, "화산 크루즈", ["네아 카메니 화산", "팔레아 카메니 온천", "티라시아 섬"], ("호텔식", "선상 BBQ", "피라 레스토랑"), "피라 칼데라 뷰 호텔", "요트로 칼데라를 돌며 화산섬을 트레킹하고 온천에서 수영합니다. 티라시아 섬에서 쉬었다가 저녁에 돌아옵니다."),
            _day(4, "칼데라 트레일과 와이너리", ["피라", "피로스테파니", "이메로비글리", "스카로스 록", "산토 와인즈"], ("호텔식", "이메로비글리 카페", "와이너리 페어링 디너"), "피라 칼데라 뷰 호텔", "오전에 칼데라 절벽길을 따라 이메로비글리까지 걷습니다(약 3km). 오후에는 산토 와인즈에서 일몰과 함께 시음합니다."),
            _day(5, "해변과 유적, 자유 시간", ["아크로티리 유적", "레드 비치", "페리사 블랙 비치", "카마리"], ("호텔식", "카마리 비치 레스토랑", "자유식"), "피라 칼데라 뷰 호텔", "아크로티리 선사 유적을 보고 레드 비치, 블랙 비치를 차례로 들릅니다. 오후는 자유 시간입니다."),
            _day(6, "산토리니 출발", ["산토리니 공항", "아테네 공항"], ("호텔식", "기내식", "기내식"), "기내", "오후 산토리니에서 아테네로 이동해 인천행 비행기로 갈아탑니다."),
            _day(7, "인천 도착", ["인천국제공항"], ("기내식", "-", "-"), "-", "오후 인천 도착 후 해산합니다."),
        ],
        departures=[DepartureSpec(24, 10, [2, 2]), DepartureSpec(52, 10), DepartureSpec(88, 12, [2, 2, 2])],
    ),
    PackageSpec(
        slug="jeju-honeymoon",
        theme="honeymoon",
        title="제주 프라이빗 풀빌라 허니문 3일",
        subtitle="독채 풀빌라 2박, 프라이빗 디너와 동부 해안 드라이브",
        region="제주",
        country="대한민국",
        nights=2,
        days=3,
        prices={"grand": 890_000, "premium": 1_390_000},
        summary="공항 픽업부터 풀빌라 체크인, 우도 나들이까지 두 분만을 위한 세단이 함께합니다. 첫날 저녁은 빌라에서 프라이빗 디너로 준비합니다.",
        highlights=["독채 프라이빗 풀빌라 2박", "첫날 저녁 빌라 프라이빗 디너", "우도 서빈백사 & 성산일출봉", "애월 카페거리 선셋"],
        badges=["출발 확정 임박"],
        rating=4.7,
        review_count=356,
        includes=["왕복 항공권(김포~제주)"] + INCL_DOMESTIC + ["프라이빗 디너 1회", "우도 도항선 왕복"],
        excludes=EXCL_DOMESTIC,
        notes="풀빌라는 성수기(7~8월)에는 온수풀 추가 요금이 있을 수 있습니다. 우도 도항선은 기상에 따라 결항될 수 있습니다.",
        itinerary=[
            _day(1, "제주 도착, 서쪽 해안과 풀빌라", ["제주국제공항", "애월 카페거리", "협재해수욕장", "풀빌라"], ("-", "애월 카페 브런치", "빌라 프라이빗 디너"), "서귀포 프라이빗 풀빌라", "공항에서 세단으로 픽업해 애월 해안도로를 따라 협재까지 드라이브합니다. 저녁은 빌라로 셰프가 방문하는 프라이빗 디너입니다."),
            _day(2, "동부 해안과 우도", ["성산일출봉", "섭지코지", "우도 서빈백사", "우도봉", "쇠소깍"], ("빌라 조식", "우도 땅콩 아이스크림·해물짬뽕", "서귀포 흑돼지"), "서귀포 프라이빗 풀빌라", "성산일출봉에 오른 뒤 도항선으로 우도에 건너가 서빈백사와 우도봉을 둘러봅니다. 돌아오는 길에 쇠소깍에 들립니다."),
            _day(3, "남서쪽 정원과 귀가", ["카멜리아힐", "오설록 티뮤지엄", "제주국제공항"], ("빌라 조식", "오설록 인근 식당", "-"), "-", "체크아웃 후 카멜리아힐과 오설록을 둘러보고 공항으로 이동합니다."),
        ],
        departures=[DepartureSpec(15, 10, [2, 2, 2, 2]), DepartureSpec(29, 10, [2]), DepartureSpec(50, 12), DepartureSpec(85, 12)],
    ),
    PackageSpec(
        slug="kyushu-parents",
        theme="parents",
        title="규슈 온천 효도 힐링 4일",
        subtitle="유후인 료칸 1박과 벳부 온천 1박, 하루 두 곳만 여유롭게",
        region="후쿠오카·벳부",
        country="일본",
        nights=3,
        days=4,
        prices={"grand": 1_290_000, "premium": 1_890_000},
        summary="후쿠오카 직항으로 들어가 유후인과 벳부 온천에서 하루씩 묵고 후쿠오카 시내에서 마무리합니다. 료칸 가이세키 저녁이 포함됩니다.",
        highlights=["유후인 긴린호수와 유노쓰보 거리", "벳부 지옥온천(우미지고쿠·치노이케지고쿠)", "료칸 가이세키 저녁 1회", "다자이후 텐만구 참배"],
        badges=["인기"],
        rating=4.8,
        review_count=923,
        includes=INCL_OVERSEAS + ["료칸 가이세키 1회", "온천 입욕세"],
        excludes=EXCL_OVERSEAS,
        notes="료칸은 다다미 객실이며 요청 시 침대 객실로 바꿔 드립니다(한정). 이동 시간은 하루 2시간 안으로 짰습니다.",
        itinerary=[
            _day(1, "후쿠오카 도착, 다자이후와 유후인", ["후쿠오카 공항", "다자이후 텐만구", "유후인 긴린호수", "유노쓰보 거리"], ("-", "다자이후 우메가에모치·우동", "료칸 가이세키"), "유후인 온천 료칸", "후쿠오카 도착 후 다자이후 텐만구에 들렀다가 유후인으로 이동합니다. 긴린호수를 산책하고 료칸에서 가이세키 저녁과 온천을 즐깁니다."),
            _day(2, "벳부 지옥온천 순례", ["우미지고쿠", "치노이케지고쿠", "칸나와 온천마을", "벳부 온천 호텔"], ("료칸 조식", "칸나와 지고쿠무시 찜요리", "호텔 뷔페"), "벳부 온천 호텔", "벳부의 대표 지옥온천 두 곳을 보고, 칸나와 마을에서 온천 증기로 찐 점심을 드십니다. 오후는 호텔 온천에서 휴식합니다."),
            _day(3, "후쿠오카 시내", ["구로카와 온천마을", "캐널시티 하카타", "나카스 야타이"], ("호텔 조식", "구로카와 향토 정식", "나카스 야타이 라멘·꼬치"), "후쿠오카 시내 호텔", "구로카와 온천마을을 산책한 뒤 후쿠오카로 이동합니다. 저녁은 나카스 강변 야타이(노점) 골목에서 드십니다."),
            _day(4, "오호리 공원과 귀국", ["오호리 공원", "후쿠오카 공항", "인천국제공항"], ("호텔 조식", "기내식", "-"), "-", "오호리 공원을 산책하고 공항으로 이동해 귀국합니다."),
        ],
        departures=[DepartureSpec(21, 14, [3, 4]), DepartureSpec(44, 14, [3]), DepartureSpec(75, 16), DepartureSpec(110, 16, [3, 3])],
    ),
    PackageSpec(
        slug="zhangjiajie-parents",
        theme="parents",
        title="장가계 · 천문산 효도 여행 5일",
        subtitle="케이블카와 엘리베이터로 오르는 무릉원, 걷는 구간은 최소로",
        region="장가계",
        country="중국",
        nights=4,
        days=5,
        prices={"grand": 1_190_000, "premium": 1_690_000},
        summary="장가계 직항으로 이동해 천문산과 무릉원을 하루씩 봅니다. 천문산 케이블카, 백룡엘리베이터, 십리화랑 모노레일 등 편의 시설 비용이 모두 포함되어 걷는 구간이 짧습니다.",
        highlights=["천문산 유리잔도 & 귀곡잔도", "원가계 아바타 할렐루야산", "백룡엘리베이터 · 십리화랑 모노레일 포함", "보봉호 유람선"],
        badges=["인기"],
        rating=4.6,
        review_count=1041,
        includes=INCL_OVERSEAS + ["천문산 케이블카", "백룡엘리베이터", "십리화랑 모노레일", "보봉호 유람선"],
        excludes=EXCL_OVERSEAS + ["천문호선 공연(선택)"],
        notes="비자 비용은 포함되어 있지 않습니다(단체비자 대행 가능). 고지대 계단 구간은 우회 코스로 안내합니다.",
        itinerary=[
            _day(1, "장가계 도착", ["인천국제공항", "장가계 허화 공항", "장가계 시내"], ("-", "기내식", "호텔 중식"), "장가계 시내 호텔", "직항으로 장가계에 도착해 호텔에 체크인합니다."),
            _day(2, "천문산", ["천문산 케이블카", "유리잔도", "귀곡잔도", "천문동(에스컬레이터)"], ("호텔 조식", "천문산 현지식", "장가계 특선 중식"), "장가계 시내 호텔", "세계 최장 케이블카로 천문산에 올라 유리잔도와 귀곡잔도를 걷습니다. 천문동은 에스컬레이터로 오르내립니다."),
            _day(3, "무릉원 원가계", ["백룡엘리베이터", "원가계", "아바타 할렐루야산", "천자산", "미혼대"], ("호텔 조식", "무릉원 현지식", "샤브샤브"), "무릉원 호텔", "백룡엘리베이터로 원가계에 올라 아바타 촬영지를 봅니다. 천자산에서 케이블카로 내려옵니다."),
            _day(4, "십리화랑과 보봉호", ["십리화랑 모노레일", "금편계곡", "보봉호 유람선", "안마 서비스"], ("호텔 조식", "보봉호 현지식", "호텔 중식"), "장가계 시내 호텔", "모노레일로 십리화랑을 보고 금편계곡 평지 구간을 짧게 걷습니다. 오후 보봉호 유람선 뒤 호텔에서 안마 서비스를 받습니다."),
            _day(5, "귀국", ["장가계 허화 공항", "인천국제공항"], ("호텔 조식", "기내식", "-"), "-", "오전 출발해 오후 인천에 도착합니다."),
        ],
        departures=[DepartureSpec(27, 16, [3, 3]), DepartureSpec(55, 16), DepartureSpec(96, 18, [4, 3])],
    ),
    PackageSpec(
        slug="gangwon-parents",
        theme="parents",
        title="강원 정선 · 강릉 힐링 효도 3일",
        subtitle="정선 레일바이크와 강릉 바다, 서울 출발 전용 밴",
        region="강원",
        country="대한민국",
        nights=2,
        days=3,
        prices={"grand": 590_000, "premium": 890_000},
        summary="서울에서 전용 밴으로 출발해 정선 아리랑시장과 레일바이크를 보고 강릉에서 2박 합니다. 첫날 저녁 숙소에서 안마 서비스를 받습니다.",
        highlights=["정선 레일바이크 & 아리랑시장", "정동진 일출과 안목해변 커피거리", "오죽헌 · 경포호 산책", "숙소 안마 서비스 포함"],
        badges=["신규"],
        rating=4.7,
        review_count=88,
        includes=INCL_DOMESTIC + ["정선 레일바이크", "하슬라 아트월드 입장"],
        excludes=EXCL_DOMESTIC,
        notes="서울 출발지는 잠실역·서울역 중 선택합니다. 레일바이크는 기상 상황에 따라 화암동굴로 대체될 수 있습니다.",
        itinerary=[
            _day(1, "서울 출발, 정선", ["서울역", "정선 아리랑시장", "정선 레일바이크(구절리~아우라지)", "화암동굴"], ("-", "아리랑시장 곤드레밥", "강릉 초당순두부"), "강릉 경포 호텔", "오전 서울 출발 후 정선 아리랑시장에서 점심을 드시고 레일바이크를 탑니다. 강릉으로 이동해 체크인 후 안마 서비스를 받습니다."),
            _day(2, "강릉 바다와 문화", ["정동진", "하슬라 아트월드", "안목해변 커피거리", "경포호", "오죽헌"], ("호텔 조식", "정동진 생선구이", "강릉 한정식"), "강릉 경포 호텔", "정동진 바다를 보고 하슬라 아트월드를 관람합니다. 안목해변에서 커피 한 잔 후 경포호와 오죽헌을 천천히 걷습니다."),
            _day(3, "시장과 귀가", ["주문진 수산시장", "강릉 중앙시장", "서울역"], ("호텔 조식", "주문진 물회·회덮밥", "-"), "-", "주문진 수산시장과 중앙시장을 둘러보고 오후 서울로 돌아옵니다."),
        ],
        departures=[DepartureSpec(16, 18, [3, 4, 3]), DepartureSpec(30, 18, [3]), DepartureSpec(58, 18), DepartureSpec(93, 18)],
    ),
    PackageSpec(
        slug="danang-golf",
        theme="golf",
        title="다낭 골프 챌린지 36홀 5일",
        subtitle="BRG 다낭 골프 리조트 18홀 × 2회, 바나힐과 호이안까지",
        region="다낭",
        country="베트남",
        nights=3,
        days=5,
        prices={"classic": 1_090_000, "grand": 1_390_000, "premium": 1_990_000},
        summary="닉 팔도가 설계한 BRG 다낭 골프 리조트에서 두 번 라운딩합니다. 그린피·카트·캐디피가 포함되어 있고, 마지막 날은 바나힐과 호이안을 둘러봅니다.",
        highlights=["BRG 다낭 골프 리조트 18홀 × 2회(그린피·카트·캐디피 포함)", "바나힐 골든브릿지", "호이안 올드타운 야경", "라운딩 후 마사지 90분"],
        badges=["인기"],
        rating=4.8,
        review_count=677,
        includes=INCL_OVERSEAS + ["그린피 2회", "카트·캐디피", "골프백 운송", "마사지 90분 1회"],
        excludes=EXCL_OVERSEAS + ["캐디팁", "골프장 내 식음료"],
        notes="티오프는 오전 7~8시로 잡습니다. 우기(9~12월)에는 오후 소나기에 대비해 오전 라운딩만 진행합니다.",
        itinerary=[
            _day(1, "인천 출발, 다낭 도착", ["인천국제공항", "다낭 국제공항", "리조트"], ("-", "-", "기내식"), "다낭 리조트", "저녁 비행기로 다낭에 도착해 리조트에 체크인합니다. 골프백은 저희가 골프장으로 미리 보냅니다."),
            _day(2, "1차 라운딩", ["BRG 다낭 골프 리조트(닉 팔도 코스) 18홀", "미케비치", "안토이 야시장"], ("호텔 조식", "클럽하우스", "미케비치 씨푸드"), "다낭 리조트", "이른 티오프로 18홀을 돌고, 오후에는 미케비치에서 쉬거나 야시장을 둘러봅니다."),
            _day(3, "2차 라운딩과 마사지", ["BRG 다낭 골프 리조트 18홀", "마사지 90분", "한시장", "용다리"], ("호텔 조식", "클럽하우스", "한강변 현지식"), "다낭 리조트", "두 번째 라운딩 후 마사지로 피로를 풀고, 저녁에는 용다리 불쇼를 봅니다(주말)."),
            _day(4, "바나힐과 호이안", ["바나힐 케이블카", "골든브릿지", "프렌치 빌리지", "호이안 올드타운", "다낭 국제공항"], ("호텔 조식", "바나힐 뷔페", "호이안 현지식"), "기내", "바나힐 골든브릿지를 보고 저녁에는 등불이 켜진 호이안 올드타운을 걷습니다. 밤 비행기로 출발합니다."),
            _day(5, "인천 도착", ["인천국제공항"], ("기내식", "-", "-"), "-", "오전 인천 도착 후 해산합니다."),
        ],
        departures=[DepartureSpec(19, 12, [4, 3]), DepartureSpec(40, 12, [3, 3, 3]), DepartureSpec(68, 16), DepartureSpec(101, 16, [4])],
    ),
    PackageSpec(
        slug="jeju-golf",
        theme="golf",
        title="제주 명문 골프장 라운딩 3일",
        subtitle="핀크스와 세인트포, 중문에서 2박",
        region="제주",
        country="대한민국",
        nights=2,
        days=3,
        prices={"classic": 690_000, "grand": 890_000, "premium": 1_290_000},
        summary="첫날 핀크스 골프클럽, 둘째 날 세인트포 골프클럽에서 각각 18홀을 돕니다. 그린피와 카트비가 포함되어 있고, 중문 숙소에서 2박 합니다.",
        highlights=["핀크스 골프클럽 18홀", "세인트포 골프클럽 18홀", "서귀포 매일올레시장", "김포~제주 왕복 항공 포함"],
        badges=["출발 확정 임박", "인기"],
        rating=4.7,
        review_count=534,
        includes=["왕복 항공권(김포~제주)"] + INCL_DOMESTIC + ["그린피 2회", "카트비"],
        excludes=EXCL_DOMESTIC + ["캐디피(팀당 별도 정산)"],
        notes="티오프는 오전 8시 전후이며 기상 악화 시 다른 골프장으로 대체될 수 있습니다.",
        itinerary=[
            _day(1, "제주 도착, 핀크스 라운딩", ["제주국제공항", "핀크스 골프클럽 18홀", "중문관광단지"], ("-", "클럽하우스", "중문 흑돼지"), "중문 호텔", "오전 비행기로 도착해 곧바로 핀크스에서 라운딩합니다. 저녁은 중문에서 드십니다."),
            _day(2, "세인트포 라운딩", ["세인트포 골프클럽 18홀", "서귀포 매일올레시장", "천지연폭포"], ("호텔 조식", "클럽하우스", "서귀포 갈치조림"), "중문 호텔", "세인트포에서 18홀을 돌고 오후에는 매일올레시장과 천지연폭포를 둘러봅니다."),
            _day(3, "자유 일정과 귀가", ["성산일출봉 또는 카페 투어", "제주국제공항"], ("호텔 조식", "자유식", "-"), "-", "체크아웃 후 자유 시간을 보내고 오후 비행기로 돌아옵니다."),
        ],
        departures=[DepartureSpec(20, 12, [4, 3]), DepartureSpec(34, 12, [3, 3, 3]), DepartureSpec(62, 12), DepartureSpec(97, 16, [3])],
    ),
    PackageSpec(
        slug="chiangmai-golf",
        theme="golf",
        title="치앙마이 골프 & 스파 5일",
        subtitle="알파인과 하이랜드 36홀, 타이 마사지와 도이수텝",
        region="치앙마이",
        country="태국",
        nights=3,
        days=5,
        prices={"classic": 1_190_000, "grand": 1_490_000, "premium": 2_090_000},
        summary="치앙마이 대표 코스 두 곳에서 라운딩하고 타이 마사지 2시간을 받습니다. 마지막 날에는 도이수텝 사원과 올드시티를 둘러봅니다.",
        highlights=["알파인 골프 리조트 치앙마이 18홀", "치앙마이 하이랜드 골프 & 스파 18홀", "타이 마사지 2시간", "도이수텝 사원 & 선데이 마켓"],
        badges=["신규"],
        rating=4.6,
        review_count=142,
        includes=INCL_OVERSEAS + ["그린피 2회", "카트·캐디피", "타이 마사지 2시간 1회"],
        excludes=EXCL_OVERSEAS + ["캐디팁"],
        notes="11~2월이 건기로 라운딩에 가장 좋습니다. 3~4월은 연무가 있을 수 있습니다.",
        itinerary=[
            _day(1, "인천 출발, 치앙마이 도착", ["인천국제공항", "치앙마이 국제공항"], ("-", "-", "기내식"), "치앙마이 호텔", "밤 늦게 치앙마이에 도착해 호텔에 체크인합니다."),
            _day(2, "알파인 라운딩", ["알파인 골프 리조트 치앙마이 18홀", "님만해민", "원님만"], ("호텔 조식", "클럽하우스", "님만해민 북부 타이식"), "치앙마이 호텔", "알파인 골프 리조트에서 18홀을 돌고 오후에는 님만해민 거리에서 쉽니다."),
            _day(3, "하이랜드 라운딩과 마사지", ["치앙마이 하이랜드 골프 & 스파 리조트 18홀", "타이 마사지 2시간", "나이트 바자"], ("호텔 조식", "클럽하우스", "나이트 바자 현지식"), "치앙마이 호텔", "하이랜드 코스 라운딩 후 마사지를 받고 저녁에는 나이트 바자를 둘러봅니다."),
            _day(4, "도이수텝과 올드시티", ["도이수텝 사원", "왓 체디루앙", "선데이 마켓", "치앙마이 국제공항"], ("호텔 조식", "카오소이 현지식", "선데이 마켓 자유식"), "기내", "도이수텝 사원에서 시내를 내려다보고 올드시티를 산책합니다. 밤 비행기로 출발합니다."),
            _day(5, "인천 도착", ["인천국제공항"], ("기내식", "-", "-"), "-", "오전 인천 도착 후 해산합니다."),
        ],
        departures=[DepartureSpec(33, 12, [3]), DepartureSpec(61, 12), DepartureSpec(104, 16, [3, 3])],
    ),
    PackageSpec(
        slug="poonhill-trekking",
        theme="trekking",
        title="히말라야 푼힐 전망 트레킹 8일",
        subtitle="안나푸르나와 다울라기리를 한눈에, 포터 동행 4일 트레킹",
        region="포카라",
        country="네팔",
        nights=6,
        days=8,
        prices={"classic": 1_690_000, "grand": 2_090_000, "premium": 2_790_000},
        summary="카트만두와 포카라를 거쳐 나야풀에서 출발하는 3박 4일 롯지 트레킹입니다. 최고 고도 3,210m 푼힐에서 일출을 봅니다. 가이드 1명, 2인당 포터 1명이 동행합니다.",
        highlights=["푼힐(3,210m) 일출 전망", "울레리~고레파니 랄리구라스 숲길", "가이드 + 2인당 포터 1명 동행", "포카라 페와 호수 휴식"],
        badges=["인기"],
        rating=4.9,
        review_count=268,
        includes=INCL_OVERSEAS + ["ACAP·TIMS 퍼밋", "가이드·포터", "트레킹 중 롯지 숙박·식사", "국내선(카트만두~포카라) 왕복"],
        excludes=EXCL_OVERSEAS + ["가이드·포터 팁", "트레킹 중 음료·핫샤워", "네팔 비자(도착 비자 USD 30)"],
        notes="트레킹 구간 숙박은 롯지(다인실 또는 2인실)로 스타일과 무관하게 동일합니다. 스타일 차이는 카트만두·포카라 호텔과 식사에 반영됩니다. 침낭·스틱은 대여해 드립니다.",
        itinerary=[
            _day(1, "인천 출발, 카트만두 도착", ["인천국제공항", "트리부반 국제공항", "타멜"], ("-", "기내식", "타멜 네팔식"), "카트만두 호텔", "카트만두에 도착해 타멜 인근 호텔에 체크인하고 트레킹 준비 점검을 합니다."),
            _day(2, "포카라 이동", ["카트만두 국내선", "포카라", "페와 호수", "레이크사이드"], ("호텔 조식", "레이크사이드 현지식", "호텔 정식"), "포카라 호텔", "국내선으로 포카라에 이동합니다. 오후에는 페와 호수에서 보트를 타며 마차푸차레를 바라봅니다."),
            _day(3, "나야풀 → 울레리(1,960m)", ["나야풀", "비레탄티", "티케둥가", "울레리"], ("호텔 조식", "티케둥가 롯지", "울레리 롯지"), "울레리 롯지", "차량으로 나야풀까지 이동해 트레킹을 시작합니다. 티케둥가에서 울레리까지 3,000개 돌계단 구간이 이어집니다(약 5시간)."),
            _day(4, "울레리 → 고레파니(2,860m)", ["반탄티", "낭게탄티", "고레파니"], ("롯지 조식", "낭게탄티 롯지", "고레파니 롯지"), "고레파니 롯지", "랄리구라스(네팔 국화) 숲길을 따라 고레파니까지 오릅니다(약 5시간). 오후에는 마을을 둘러보며 고도 적응을 합니다."),
            _day(5, "푼힐 일출 → 타다파니(2,630m)", ["푼힐(3,210m)", "데우랄리", "반탄티", "타다파니"], ("롯지 조식", "반탄티 롯지", "타다파니 롯지"), "타다파니 롯지", "새벽에 푼힐에 올라 안나푸르나 남봉, 다울라기리, 마차푸차레 위로 뜨는 해를 봅니다. 하산 후 데우랄리 능선을 넘어 타다파니로 이동합니다(약 6시간)."),
            _day(6, "타다파니 → 간드룽 → 포카라", ["간드룽(1,940m)", "킴체", "나야풀", "포카라"], ("롯지 조식", "간드룽 롯지", "포카라 호텔 정식"), "포카라 호텔", "구룽족 마을 간드룽까지 내려가 점심을 먹고 나야풀에서 차량으로 포카라로 돌아옵니다."),
            _day(7, "카트만두 시내와 출발", ["카트만두 국내선", "더르바르 광장", "타멜", "트리부반 국제공항"], ("호텔 조식", "타멜 현지식", "기내식"), "기내", "오전 카트만두로 이동해 더르바르 광장을 둘러보고 저녁 비행기로 출발합니다."),
            _day(8, "인천 도착", ["인천국제공항"], ("기내식", "-", "-"), "-", "오전 인천 도착 후 해산합니다."),
        ],
        departures=[DepartureSpec(28, 10, [3, 3]), DepartureSpec(63, 10, [4]), DepartureSpec(112, 12)],
    ),
    PackageSpec(
        slug="jirisan-trekking",
        theme="trekking",
        title="지리산 종주 트레킹 3일",
        subtitle="성삼재에서 천왕봉까지, 대피소 2박 완주 코스",
        region="지리산",
        country="대한민국",
        nights=2,
        days=3,
        prices={"classic": 390_000, "grand": 590_000, "premium": 890_000},
        summary="성삼재에서 출발해 노고단, 벽소령, 장터목을 거쳐 천왕봉 일출을 보고 중산리로 내려오는 33km 종주입니다. 대피소 예약과 식사 준비는 저희가 합니다.",
        highlights=["천왕봉(1,915m) 일출", "노고단~연하천 주능선 숲길", "대피소 2박 예약 대행", "서울 출발 전용 밴"],
        badges=["인기"],
        rating=4.8,
        review_count=445,
        includes=INCL_DOMESTIC + ["대피소 2박", "취사 식사 재료", "산악 가이드"],
        excludes=EXCL_DOMESTIC + ["개인 장비", "하산 후 목욕"],
        notes="대피소 숙박은 스타일과 무관하게 동일하며 스타일 차이는 출발 전날 서울 출발 시간과 하산 후 식사에 반영됩니다. 기상 악화 시 코스가 단축될 수 있습니다.",
        itinerary=[
            _day(1, "성삼재 → 노고단 → 연하천 대피소", ["서울역", "성삼재", "노고단 고개", "임걸령", "삼도봉", "연하천 대피소"], ("-", "행동식", "대피소 취사"), "연하천 대피소", "새벽 서울 출발 후 성삼재에서 산행을 시작합니다. 노고단 고개를 지나 주능선을 따라 연하천까지 약 11km 걷습니다."),
            _day(2, "연하천 → 벽소령 → 장터목 대피소", ["형제봉", "벽소령 대피소", "세석 대피소", "촛대봉", "장터목 대피소"], ("대피소 취사", "벽소령 행동식", "대피소 취사"), "장터목 대피소", "가장 긴 구간입니다(약 15km). 벽소령에서 점심을 먹고 세석평전을 지나 장터목에 도착합니다."),
            _day(3, "천왕봉 일출 → 중산리 하산", ["제석봉", "천왕봉", "법계사", "중산리", "서울역"], ("행동식", "중산리 산채정식", "-"), "-", "새벽 천왕봉에 올라 일출을 보고 중산리로 하산합니다(약 5.4km). 점심 후 서울로 돌아옵니다."),
        ],
        departures=[DepartureSpec(14, 12, [3, 4, 3]), DepartureSpec(35, 12, [3]), DepartureSpec(56, 12), DepartureSpec(84, 12)],
    ),
    PackageSpec(
        slug="hokkaido-trekking",
        theme="trekking",
        title="홋카이도 다이세츠산 트레킹 5일",
        subtitle="아사히다케와 구로다케, 로프웨이로 오르는 고원 트레킹과 온천",
        region="홋카이도",
        country="일본",
        nights=3,
        days=5,
        prices={"classic": 1_290_000, "grand": 1_590_000, "premium": 2_190_000},
        summary="다이세츠산 국립공원의 아사히다케와 구로다케를 로프웨이로 올라 하루 3~5시간씩 걷습니다. 매일 온천 숙소에 묵고 마지막 날은 비에이와 삿포로를 둘러봅니다.",
        highlights=["아사히다케 스가타미 연못 트레킹", "구로다케 정상(1,984m) 산행", "소운쿄 협곡과 온천", "비에이 청의 호수"],
        badges=["신규"],
        rating=4.7,
        review_count=61,
        includes=INCL_OVERSEAS + ["로프웨이 2회", "온천 입욕세"],
        excludes=EXCL_OVERSEAS + ["개인 장비"],
        notes="7~9월 출발만 운영합니다. 산 위는 여름에도 10도 안팎이라 방풍 재킷이 필요합니다.",
        itinerary=[
            _day(1, "인천 출발, 아사히카와 이동", ["인천국제공항", "신치토세 공항", "아사히카와"], ("-", "기내식", "아사히카와 쇼유라멘"), "아사히카와 호텔", "신치토세에 도착해 아사히카와로 이동합니다."),
            _day(2, "아사히다케 트레킹", ["아사히다케 로프웨이", "스가타미 연못", "아사히다케 온천"], ("호텔 조식", "산행 도시락", "온천 료칸 정식"), "아사히다케 온천 료칸", "로프웨이로 1,600m까지 올라 스가타미 연못 둘레길과 분기공 전망대를 돕니다(약 3시간). 저녁은 온천 료칸에서 쉽니다."),
            _day(3, "구로다케 산행", ["소운쿄 협곡", "구로다케 로프웨이", "구로다케 정상", "소운쿄 온천"], ("료칸 조식", "산행 도시락", "소운쿄 온천 뷔페"), "소운쿄 온천 호텔", "소운쿄에서 로프웨이와 리프트로 7합목까지 오른 뒤 정상까지 약 1.5시간 산행합니다. 하산 후 협곡을 산책하고 온천에서 피로를 풉니다."),
            _day(4, "비에이와 삿포로", ["비에이 청의 호수", "시로가네 폭포", "후라노", "삿포로 스스키노"], ("호텔 조식", "후라노 오므카레", "삿포로 징기스칸"), "삿포로 호텔", "비에이 청의 호수와 후라노를 거쳐 삿포로로 이동합니다. 저녁은 스스키노에서 드십니다."),
            _day(5, "귀국", ["신치토세 공항", "인천국제공항"], ("호텔 조식", "기내식", "-"), "-", "오전 신치토세에서 출발해 오후 인천에 도착합니다."),
        ],
        departures=[DepartureSpec(23, 12, [3, 3]), DepartureSpec(48, 12), DepartureSpec(90, 14, [4]), DepartureSpec(118, 14)],
    ),
]

# 다른 고객 예약의 동행 이름(결정적 순서로 사용)
COMPANION_NAMES = ["김하늘", "정우진", "윤서아", "장도윤", "임지호", "배수아", "조은우", "신예린", "강시우", "문하린", "권지안", "송민서", "홍유준", "노채원", "류건우", "서지우"]


# ---------------------------------------------------------------------------
# 시드 로직
# ---------------------------------------------------------------------------

def _upsert_users(db: Session) -> dict[str, User]:
    users: dict[str, User] = {}
    for email, password, role, name, phone, address in ACCOUNTS:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=hash_password(password), role=role)
            user.name, user.phone, user.address = name, phone, address
            db.add(user)
        users[email] = user
    db.flush()
    return users


def _upsert_inventory(db: Session, admin: User) -> dict[str, InventoryItem]:
    items: dict[str, InventoryItem] = {}
    for sku, name, category, unit, stock, reorder in INVENTORY:
        item = db.scalar(select(InventoryItem).where(InventoryItem.sku == sku))
        if item is None:
            item = InventoryItem(sku=sku, name=name, category=category, unit=unit, stock_qty=stock, reorder_level=reorder)
            db.add(item)
            db.flush()
            db.add(InventoryMove(item_id=item.id, type="in", qty=stock, memo="초기 입고", created_by=admin.id))
        items[sku] = item
    db.flush()
    return items


def _upsert_themes(db: Session, items: dict[str, InventoryItem]) -> dict[str, Theme]:
    themes: dict[str, Theme] = {}
    for order, spec in enumerate(THEMES, start=1):
        theme = db.scalar(select(Theme).where(Theme.slug == spec["slug"]))
        if theme is not None:
            themes[spec["slug"]] = theme
            continue
        if theme is None:
            theme = Theme(slug=spec["slug"])
            db.add(theme)
        for key in ("name", "tagline", "description", "icon", "hero_image", "min_style_rank", "min_travelers", "vehicle_label", "default_transport"):
            setattr(theme, key, spec[key])
        theme.sort_order, theme.is_active = order, True
        theme.perks = [
            ThemePerk(label=label, inventory_item_id=items[sku].id if sku else None, qty_per_booking=qty, per_person=per_person)
            for label, sku, qty, per_person in spec["perks"]
        ]
        themes[spec["slug"]] = theme
    db.flush()
    return themes


def _upsert_meal_addons(db: Session) -> None:
    for code, label, price in MEAL_ADDONS:
        row = db.scalar(select(MealAddon).where(MealAddon.code == code))
        if row is None:
            row = MealAddon(code=code)
            db.add(row)
        row.label, row.price, row.is_active = label, price, True
    db.flush()


def _upsert_packages(db: Session, themes: dict[str, Theme], today: date) -> dict[str, Package]:
    packages: dict[str, Package] = {}
    for spec in PACKAGES:
        package = db.scalar(select(Package).where(Package.slug == spec.slug))
        is_new = package is None
        if is_new:
            package = Package(slug=spec.slug)
            db.add(package)
        package.theme_id = themes[spec.theme].id
        package.title, package.subtitle = spec.title, spec.subtitle
        package.region, package.country = spec.region, spec.country
        package.nights, package.days = spec.nights, spec.days
        package.hero_images = package_images(spec.slug)
        package.summary, package.highlights, package.badges = spec.summary, spec.highlights, spec.badges
        package.includes, package.excludes, package.notes = spec.includes, spec.excludes, spec.notes
        package.rating, package.review_count, package.is_published = spec.rating, spec.review_count, True
        package.set_style_prices(spec.prices)
        package.itinerary = [PackageItinerary(**d) for d in spec.itinerary]
        if is_new:
            # 출발일정은 처음 만들 때만 넣는다 (예약이 걸려 있을 수 있으므로 재실행 시 건드리지 않음)
            for dep in spec.departures:
                depart = today + timedelta(days=dep.offset_days)
                package.departures.append(
                    Departure(depart_date=depart, return_date=depart + timedelta(days=spec.days - 1), capacity=dep.capacity, status="open")
                )
        packages[spec.slug] = package
    db.flush()
    return packages


def _seed_booking(
    db: Session,
    user: User,
    package: Package,
    departure: Departure,
    style: str,
    travelers: list[TravelerIn],
    created_at: datetime,
    memo: str = "",
    meal_code: str | None = None,
) -> Booking:
    payload = BookingCreate(
        package_id=package.id,
        departure_id=departure.id,
        style_code=style,
        meal_code=meal_code,
        travelers_count=len(travelers),
        travelers=travelers,
        memo=memo,
    )
    booking = booking_service.build_booking(db, user, package, departure, payload)
    booking.created_at = created_at
    booking.payment_method = "card"
    booking.paid_at = created_at + timedelta(minutes=3)
    InventoryService(db).reserve_theme_perks(booking, package.theme, NotificationService(db, ConsoleSmsProvider()))
    return booking


def _confirm_at(db: Session, booking: Booking, when: datetime) -> None:
    """서비스의 확정 전이(물품 출고 + 알림)를 그대로 쓰고 시각만 과거로 맞춘다."""
    notifications = booking_service.transition_to_confirmed(db, booking, NotificationService(db, ConsoleSmsProvider()))
    booking.confirmed_at = when
    db.flush()
    for n in notifications:
        n.created_at, n.sent_at = when, when
    for m in db.scalars(select(InventoryMove).where(InventoryMove.ref_booking_id == booking.id)).all():
        m.created_at = when


def _rep(user: User) -> TravelerIn:
    return TravelerIn(name=user.name, phone=user.phone, is_representative=True)


def _seed_filler_bookings(db: Session, users: dict[str, User], packages: dict[str, Package], today: date) -> None:
    """출발일정에 '잔여 적음' 을 만들기 위한 다른 고객들의 확정 예약."""
    fillers = [users["minjun.choi@example.com"], users["jimin.han@example.com"], users["sehun.oh@example.com"]]
    name_idx = 0
    counter = 0
    for spec in PACKAGES:
        package = packages[spec.slug]
        departures = sorted(package.departures, key=lambda d: d.depart_date)
        for dep_spec, departure in zip(spec.departures, departures, strict=True):
            for party in dep_spec.parties:
                rep_user = fillers[counter % len(fillers)]
                style = list(spec.prices)[counter % len(spec.prices)]
                travelers = [_rep(rep_user)]
                for _ in range(party - 1):
                    travelers.append(TravelerIn(name=COMPANION_NAMES[name_idx % len(COMPANION_NAMES)], phone=""))
                    name_idx += 1
                # 대시보드에 '오늘 예약'·'이번 주 확정' 이 보이도록 일부는 오늘 만든 예약으로 둔다
                days_back = 0 if counter % 6 == 0 else min(20, dep_spec.offset_days // 2) + counter % 5
                created = datetime.combine(today - timedelta(days=days_back), datetime.min.time()) + timedelta(hours=9 + counter % 8, minutes=(counter * 7) % 60)
                # 시드 시각이 현재보다 미래가 되지 않도록 (오늘 예약은 지금보다 최소 30분 전)
                created = min(created, datetime.now().replace(microsecond=0) - timedelta(minutes=30 + counter))
                booking = _seed_booking(db, rep_user, package, departure, style, travelers, created)
                _confirm_at(db, booking, booking.paid_at)
                counter += 1
    db.flush()


def _seed_demo_bookings(db: Session, users: dict[str, User], packages: dict[str, Package], today: date) -> None:
    demo = users["demo@customer.com"]
    friend1 = users["friend1@customer.com"]
    friend2 = users["friend2@customer.com"]

    # 완료된 여행 3건 (과거 출발일정을 departed 상태로 추가)
    past = [
        ("bali-honeymoon", 240, "grand", [_rep(demo), TravelerIn(name="김민준", phone="010-9876-5432")], "신혼여행이에요. 룸 데코 부탁드립니다."),
        ("kyushu-parents", 150, "grand", [_rep(demo), TravelerIn(name="시영호", phone="010-1111-2222", birth="1961-03-02"), TravelerIn(name="한미숙", phone="010-3333-4444", birth="1963-08-19")], "부모님 칠순 기념 여행입니다."),
        ("jeju-golf", 60, "classic", [_rep(demo), TravelerIn(name=friend1.name, phone=friend1.phone), TravelerIn(name=friend2.name, phone=friend2.phone)], ""),
    ]
    for slug, days_ago, style, travelers, memo in past:
        package = packages[slug]
        depart = today - timedelta(days=days_ago)
        departure = Departure(package_id=package.id, depart_date=depart, return_date=depart + timedelta(days=package.days - 1), capacity=12, status="departed")
        db.add(departure)
        db.flush()
        created = datetime.combine(depart - timedelta(days=45), datetime.min.time()) + timedelta(hours=14)
        booking = _seed_booking(db, demo, package, departure, style, travelers, created, memo=memo)
        # 친구 계정은 회원 동행으로 연결해 /me/trips 에도 보이게 한다
        for t in booking.travelers:
            if t.name == friend1.name:
                t.user_id = friend1.id
            elif t.name == friend2.name:
                t.user_id = friend2.id
        _confirm_at(db, booking, booking.paid_at)
        booking_service.complete(db, booking)
        booking.completed_at = datetime.combine(depart + timedelta(days=package.days), datetime.min.time()) + timedelta(hours=9)

    # 동행 모집 중인 예약 1건 (제주 골프, 2명, 초대 코드 고정)
    package = packages["jeju-golf"]
    departure = sorted(package.departures, key=lambda d: d.depart_date)[2]  # 세 번째 일정(여유 있음)
    created = datetime.combine(today - timedelta(days=2), datetime.min.time()) + timedelta(hours=20, minutes=12)
    gathering = _seed_booking(
        db, demo, package, departure, "grand", [_rep(demo), TravelerIn(name="김민준", phone="010-9876-5432")], created, memo="한 명 더 모집 중이에요.",
    )
    gathering.status = "gathering"
    gathering.invite_code = "MWJOIN01"
    db.commit()


def seed(db: Session, today: date | None = None) -> None:
    today = today or date.today()
    ensure_defaults(db)
    users = _upsert_users(db)
    items = _upsert_inventory(db, users["admin@mrworld.com"])
    themes = _upsert_themes(db, items)
    _upsert_meal_addons(db)
    packages = _upsert_packages(db, themes, today)
    db.commit()

    demo = users["demo@customer.com"]
    if db.scalar(select(Booking.id).where(Booking.user_id == demo.id)) is None:
        _seed_filler_bookings(db, users, packages, today)
        _seed_demo_bookings(db, users, packages, today)
        print("예약·알림·출고 이력을 새로 만들었어요.")
    else:
        print("예약 데이터가 이미 있어 예약 시드는 건너뛰었어요. (--reset 으로 초기화 가능)")
    db.commit()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="미스터 월드 테마 투어 시드 데이터")
    parser.add_argument("--reset", action="store_true", help="모든 테이블을 지우고 다시 만든 뒤 시드")
    args = parser.parse_args(argv)

    if args.reset:
        Base.metadata.drop_all(bind=engine)
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        print("기존 테이블을 모두 지웠어요.")
    create_schema(engine)

    with SessionLocal() as db:
        seed(db)
    print("시드 완료: 직원 admin@mrworld.com / admin1234, 고객 demo@customer.com / demo1234")


if __name__ == "__main__":
    main(sys.argv[1:])
