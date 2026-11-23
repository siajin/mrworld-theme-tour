# API 계약 (backend ↔ frontend 공유 · 단일 진실 원천)

Base URL: `http://localhost:8000/api/v1`  
인증: `Authorization: Bearer <access_token>` (JWT). 금액은 모두 KRW 정수(원). 날짜는 `YYYY-MM-DD`, 시각은 ISO8601.
에러 형식: `{ "detail": "사람이 읽을 메시지" }` (FastAPI 기본). 4xx/5xx.
목록 응답은 배열 그대로(페이지네이션 없음, 1단계).

## 핵심 도메인 규칙 (반드시 동일하게 구현)

1. **테마** `themes` — 직원이 CRUD. 코드 슬러그: `honeymoon`, `parents`, `golf`, `trekking` (시드). `min_style_rank`: honeymoon=2, parents=2, golf=1, trekking=1. `min_travelers`: honeymoon=2, 나머지=3 (허니문은 "2인 전용"이라 2명이면 확정. 그 외는 요구사항대로 3명).
2. **스타일** `classic(rank1, 3성, 도시락 lunchbox)`, `grand(rank2, 4성, 현지식 local)`, `premium(rank3, 5성, 고급 레스토랑 fine_dining)`.
3. **가격 계산** (1인 기준 후 인원 곱):
   ```
   style_price      = package_style_prices[style].price                 # 1인
   hotel_delta      = (hotel_surcharge[hotel_grade] - hotel_surcharge[style.default_hotel]) * package.nights
   meal_delta       = (meal_surcharge[meal_code]   - meal_surcharge[style.default_meal])   * package.days
   per_person       = style_price + hotel_delta + meal_delta
   subtotal         = per_person * travelers_count
   transport_total  = transport_surcharge[transport_code]                # 예약 1건당 (테마 기본 차량은 0)
   addons_total     = Σ addon.price * addon.qty * travelers_count        # 식사 추가옵션(샴페인/커피 등)은 1인당·1회
   discount         = floor((subtotal + transport_total + addons_total) * loyalty_rate)
   total            = subtotal + transport_total + addons_total - discount
   deposit          = floor(total * 0.1 / 1000) * 1000                   # 예약금 10%, 천원 단위 절사
   ```
   hotel_surcharge(1인·1박): 3성 0 / 4성 60,000 / 5성 150,000.
   meal_surcharge(1인·1일): lunchbox 0 / local 25,000 / fine_dining 90,000.
   transport(예약당): `sedan_2` 0(허니문 기본) / `van_10` 0(나머지 기본) / `limousine` 300,000 / `premium_bus_25` 500,000.
   loyalty_rate: completed_trips ≥ settings.loyalty_gold_trips(5) → settings.loyalty_gold_rate(0.10); ≥ silver(3) → 0.05; else 0. 등급명: `basic`/`silver`/`gold`.
   검증: `style.rank >= theme.min_style_rank` 아니면 400 "이 테마는 그랜드 스타일 이상만 선택할 수 있어요". hotel_grade ∈ {3,4,5}, meal ∈ {lunchbox, local, fine_dining}.
   세부 변경(호텔·식사)도 **테마 최소 스타일의 기본값 아래로 내려갈 수 없다** (min_style_rank=2 → 4성·현지식 이상): 400 "이 테마는 4성급 이상 호텔만 선택할 수 있어요" / "이 테마는 현지식 레스토랑 이상 식사만 선택할 수 있어요".
   `travelers_count > transport.capacity` 면 400 "2인 전용 고급 세단은 최대 2명까지 탈 수 있어요. 인원에 맞는 차량을 골라 주세요". 프론트는 같은 규칙을 `components/customer/utils.ts`(`applyOptionRules`)로 선반영해 잘못된 요청을 보내지 않는다(하한 미만 선택지는 비활성, 정원 초과 시 인원이 타는 가장 저렴한 차량으로 자동 변경 + 토스트). 한 예약의 인원 상한은 min(10, 출발일 잔여).
4. **예약 확정 (동행 기준)**: 확정 여부는 **예약 1건(대표자 + 동행)** 의 `travelers_count` 로 판단한다. 다른 고객과 합산하지 않는다.
   - `POST /bookings` → status `pending` (결제 전).
   - `POST /bookings/{id}/pay` → 예약금 결제 시뮬레이션. 이후 `travelers_count >= theme.min_travelers` 이면 `confirmed`(+ `confirmed_at`, 알림 생성, 테마 물품 출고 예약), 아니면 `gathering`(동행 모집 중).
   - `gathering` 예약은 `invite_code`(8자 대문자+숫자)를 가진다. 동행이 로그인 후 `POST /bookings/join {invite_code}` 하면 자기 계정 정보로 `booking_travelers` 한 줄 추가(`user_id` 연결), `travelers_count` +1, 가격 재계산, 인원 도달 시 `confirmed` 전이 + 대표자·동행 모두에게 알림(`sms` 채널, DB 기록).
   - 대표자는 `POST /bookings/{id}/travelers` 로 동행을 직접 추가할 수도 있다(비회원 포함). 같은 전이 규칙.
   - `cancel` 은 pending/gathering/confirmed 에서 가능 → `cancelled`. 출발일이 지나면 스케줄 없이 직원이 `completed` 처리(`/staff/bookings/{id}/complete`), 이때 대표자·회원 동행의 `completed_trips` +1.
   - departures.capacity(정원) 초과 시 400.
5. **알림** `notifications` — 채널 `sms` 고정. 기본 console은 기록만 남기며, Solapi 설정 시 실제 발송한다. `NotificationService.send(user_id, template, payload)` → DB 저장 + 콘솔 로그. 템플릿: `booking_confirmed`, `companion_joined`, `booking_cancelled`.
6. **창고**: 예약에 기본 제공 구성을 보존한다. 견적·예약 생성 시 부족 재고는 400으로 차단하고 결제 완료(모집 중 포함)·직원 확정 시 `qty_per_booking * (per_person ? travelers_count : 1)`을 차감한다. 같은 물품은 합산하며 인원 변경은 차이만 반영한다. 취소는 실제 차감분을 복원한다. 부족하면 부분 차감·결제·상태 변경을 모두 되돌리고, 반복·동시 요청에서도 음수와 이중 차감을 막는다.
7. **로그인 직후 팝업**: `GET /me/trips` 가 `[]`가 아니면 프론트가 모달 표시. 세션당 1회(sessionStorage).

## 응답 스키마

```ts
// ---- 공통
type Role = "customer" | "staff";
type StyleCode = "classic" | "grand" | "premium";
type MealCode = "lunchbox" | "local" | "fine_dining";
type TransportCode = "sedan_2" | "van_10" | "limousine" | "premium_bus_25";
type BookingStatus = "pending" | "gathering" | "confirmed" | "cancelled" | "completed";
type DepartureStatus = "open" | "closed" | "departed";

interface User { id: number; email: string; role: Role; name: string; phone: string; address: string; created_at: string;
  loyalty?: { tier: "basic"|"silver"|"gold"; completed_trips: number; rate: number; next_tier_trips: number|null } }  // customer만

interface Theme { id: number; slug: string; name: string; tagline: string; description: string; icon: string; // lucide 아이콘명: "heart","hand-heart","flag","mountain"
  hero_image: string; min_style_rank: 1|2|3; min_travelers: number; vehicle_label: string; default_transport: TransportCode;
  sort_order: number; is_active: boolean; perks: ThemePerk[]; package_count?: number; from_price?: number|null }
interface ThemePerk { id: number; label: string; inventory_item_id: number|null; qty_per_booking: number; per_person: boolean; unit: string }

interface Style { code: StyleCode; name: string; rank: number; hotel_grade: 3|4|5; meal_code: MealCode; description: string }
interface Catalog {  // GET /catalog — 옵션 마스터 한 번에
  styles: Style[];
  hotel_grades: { grade: 3|4|5; label: string; surcharge: number }[];
  meal_options: { code: MealCode; label: string; surcharge: number; description: string }[];
  transport_options: { code: TransportCode; label: string; capacity: number; surcharge: number }[];
  meal_addons: { id: number; code: string; label: string; price: number; is_active: boolean }[];
  settings: { min_travelers_default: number; loyalty_silver_trips: number; loyalty_silver_rate: number; loyalty_gold_trips: number; loyalty_gold_rate: number; deposit_rate: number } }

interface PackageCard { id: number; theme: { id:number; slug:string; name:string }; title: string; subtitle: string; region: string; country: string;
  nights: number; days: number; hero_images: string[]; from_price: number; from_style: StyleCode;  // 선택 가능한 최저 스타일 가격
  badges: string[];   // e.g. ["출발 확정 임박","인기"] 직원이 입력한 태그
  next_departure: { id:number; depart_date:string; remaining:number } | null; rating: number; review_count: number; is_published: boolean }

interface Package extends PackageCard { summary: string; includes: string[]; excludes: string[]; notes: string; highlights: string[];
  style_prices: { style_code: StyleCode; price: number; available: boolean }[];   // available = rank >= theme.min_style_rank
  itinerary: { day_no: number; title: string; places: string[]; meals: { breakfast: string; lunch: string; dinner: string }; lodging: string; description: string }[];
  departures: Departure[]; created_at: string; updated_at: string }

interface Departure { id: number; package_id: number; depart_date: string; return_date: string; capacity: number; booked: number; remaining: number; status: DepartureStatus }

interface QuoteRequest { package_id: number; departure_id: number; style_code: StyleCode; hotel_grade?: 3|4|5; meal_code?: MealCode; transport_code?: TransportCode;
  addons?: { meal_addon_id: number; qty: number }[]; travelers_count: number }
interface Quote { per_person: number; style_price: number; hotel_delta: number; meal_delta: number; subtotal: number; transport_total: number; addons_total: number;
  discount: number; discount_rate: number; total: number; deposit: number; travelers_count: number;
  resolved: { hotel_grade: 3|4|5; meal_code: MealCode; transport_code: TransportCode }; lines: { label: string; amount: number }[] }

interface TravelerIn { name: string; phone: string; birth?: string|null; is_representative?: boolean }
interface Traveler extends TravelerIn { id: number; user_id: number|null; is_representative: boolean; joined_via_code: boolean }
interface BookingCreate extends QuoteRequest { travelers: TravelerIn[]; memo?: string }   // travelers.length === travelers_count, 1명은 is_representative
interface Booking { id: number; code: string /* "MW-2026-000123" */; status: BookingStatus; customer: { id:number; name:string; phone:string; email:string };
  package: PackageCard; departure: Departure; theme: { slug:string; name:string; min_travelers:number; perks:ThemePerk[] };
  style_code: StyleCode; hotel_grade: 3|4|5; meal_code: MealCode; transport_code: TransportCode;
  addons: { meal_addon_id:number; label:string; qty:number; unit_price:number }[];
  travelers_count: number; travelers: Traveler[]; quote: Quote; invite_code: string|null; needed_more: number;  // min_travelers - travelers_count (0 이상)
  paid_at: string|null; confirmed_at: string|null; created_at: string; memo: string }

interface Trip { booking_id: number; code: string; package_title: string; theme_name: string; region: string; depart_date: string; return_date: string;
  nights: number; days: number; style_code: StyleCode; style_name: string; total: number; status: BookingStatus; hero_image: string }

interface Notification { id: number; user_id: number; user_name: string; channel: "sms"; template: string; title: string; body: string; status: "queued"|"sent"|"failed"; created_at: string; sent_at: string|null }

interface InventoryItem { id: number; sku: string; name: string; category: string; unit: string; stock_qty: number; reorder_level: number; is_active: boolean; low_stock: boolean }
interface InventoryMove { id: number; item_id: number; item_name: string; type: "in"|"out"|"adjust"; qty: number; ref_booking_id: number|null; memo: string; created_by_name: string; created_at: string }

interface StaffDashboard { today_bookings: number; gathering_bookings: number; confirmed_this_week: number; revenue_this_month: number;
  upcoming_departures: { departure: Departure; package_title: string; theme_name: string; bookings: number }[];
  low_stock_items: InventoryItem[]; recent_notifications: Notification[]; recent_bookings: Booking[] }

interface AIParseResult { theme_slug: string|null; region: string|null; depart_from: string|null; depart_to: string|null; travelers_count: number|null;
  style_code: StyleCode|null; budget_max: number|null; keywords: string[]; summary: string /* "허니문 · 5월 · 2명" */; matched_package_ids: number[] }
```

## 엔드포인트

### 인증 · 내 정보
| 메서드 | 경로 | 요청 | 응답 |
|---|---|---|---|
| POST | `/auth/signup` | `{email,password,name,phone,address}` (role은 항상 customer; 직원은 시드/직원화면에서만 생성) | `{access_token, refresh_token, token_type:"bearer", user: User}` |
| POST | `/auth/login` | `{email,password}` | 동일 |
| POST | `/auth/refresh` | `{refresh_token}` | `{access_token, refresh_token, token_type}` |
| GET | `/me` | | `User` |
| PUT | `/me` | `{name?,phone?,address?}` | `User` |
| GET | `/me/trips` | | `Trip[]` (최근 출발일 순, 모든 상태 중 cancelled 제외) |
| GET | `/me/bookings` | `?status=` | `Booking[]` |

### 고객 카탈로그
| GET | `/catalog` | | `Catalog` |
| GET | `/themes` | | `Theme[]` (활성만, sort_order) |
| GET | `/themes/{slug}` | | `Theme` |
| GET | `/packages` | `?theme=slug&style=&region=&depart_from=&depart_to=&travelers=&min_price=&max_price=&sort=recommended|price_asc|price_desc|departure_soon&q=` | `PackageCard[]` (published만) |
| GET | `/packages/featured` | | `{ popular: PackageCard[]; closing_soon: PackageCard[]; by_theme: Record<slug, PackageCard[]> }` |
| GET | `/packages/{id}` | | `Package` |
| GET | `/packages/{id}/departures` | | `Departure[]` |

### 예약
| POST | `/bookings/quote` | `QuoteRequest` | `Quote` (비로그인 허용, 로그인 시 할인 반영) |
| POST | `/bookings` | `BookingCreate` | `Booking` (status pending) |
| GET | `/bookings/{id}` | | `Booking` (본인 또는 동행 또는 staff) |
| POST | `/bookings/{id}/pay` | `{method:"card"|"transfer"}` | `Booking` (gathering 또는 confirmed) |
| POST | `/bookings/{id}/travelers` | `TravelerIn` | `Booking` |
| DELETE | `/bookings/{id}/travelers/{tid}` | | `Booking` (대표자 삭제 불가, confirmed 상태에서는 불가) |
| POST | `/bookings/join` | `{invite_code}` | `Booking` |
| GET | `/bookings/invite/{invite_code}` | | `{ booking_id, package_title, theme_name, depart_date, representative_name, travelers_count, min_travelers, needed_more }` (비로그인 미리보기) |
| POST | `/bookings/{id}/cancel` | | `Booking` |

### AI (선택)
| POST | `/ai/parse` | `{text, context?}` | `AIParseResult` + `intent`/`slots`/`reply` — 규칙 기반(키워드 사전). `context` ∈ home/search/theme/package/booking/me/other 로 화면별 명령(스타일·인원·출발일·호텔·식사 변경, n번째 선택, 예약, 이동)을 구분 |
| POST | `/ai/chat` | `{messages:[{role,content}]}` | `{ reply: string; packages: PackageCard[] }` |

### 직원 (`role=staff` 필수, 아니면 403)
| GET | `/staff/dashboard` | | `StaffDashboard` |
| GET/POST | `/staff/themes` | `ThemeIn` | `Theme` / `Theme[]` (비활성 포함) |
| PUT/DELETE | `/staff/themes/{id}` | | (패키지 있으면 삭제 대신 400) |
| PUT | `/staff/themes/reorder` | `{ids:number[]}` | `Theme[]` |
| GET/POST | `/staff/packages` | `?theme=&published=&q=` / `PackageIn` | `Package[]`/`Package` |
| GET/PUT/DELETE | `/staff/packages/{id}` | `PackageIn` | `Package` |
| POST | `/staff/packages/{id}/publish` | `{is_published:boolean}` | `Package` |
| POST/PUT/DELETE | `/staff/packages/{id}/departures[/{did}]` | `{depart_date, return_date, capacity, status}` | `Departure` |
| GET/POST | `/staff/inventory/items` | `InventoryItemIn` | `InventoryItem[]` |
| PUT | `/staff/inventory/items/{id}` | | `InventoryItem` |
| POST | `/staff/inventory/items/{id}/moves` | `{type, qty, memo}` | `InventoryItem` |
| GET | `/staff/inventory/moves` | `?item_id=` | `InventoryMove[]` |
| GET | `/staff/bookings` | `?status=&departure_id=&package_id=&q=` | `Booking[]` |
| POST | `/staff/bookings/{id}/confirm` `/cancel` `/complete` | | `Booking` |
| GET | `/staff/customers` | `?q=` | `(User & {bookings_count:number; last_trip:string|null})[]` |
| GET | `/staff/customers/{id}` | | `{ user: User; bookings: Booking[] }` |
| GET | `/staff/notifications` | `?limit=` | `Notification[]` (+ `provider`, `to`, `error`) |
| GET | `/staff/notifications/provider` | | `{provider: console\|solapi, requested, configured, sender, live}` |
| POST | `/staff/notifications/test` | `{phone, body}` | `Notification` — 현재 provider 로 테스트 발송 |
| POST | `/staff/notifications/{id}/resend` | | `Notification` — 같은 내용으로 재발송(새 행) |
| GET/PUT | `/staff/settings` | `Partial<Catalog["settings"]>` | `Catalog["settings"]` |
| POST | `/staff/upload` | multipart `file` | `{url:"/media/xxx.jpg"}` (backend가 `/media` 정적 서빙) |

`PackageIn`: `{ theme_id, title, subtitle, region, country, nights, days, hero_images: string[], summary, highlights: string[], includes: string[], excludes: string[], notes, badges: string[], style_prices: {style_code, price}[], itinerary: [...], is_published }`
`ThemeIn`: `{ slug, name, tagline, description, icon, hero_image, min_style_rank, min_travelers, vehicle_label, default_transport, is_active, perks: {label, inventory_item_id, qty_per_booking, per_person}[] }`

## 시드 데이터 (`python -m app.db.seed` — 멱등, `--reset` 으로 초기화)

계정: 직원 `admin@mrworld.com / admin1234` (name 김운영), 고객 `demo@customer.com / demo1234` (name 시아진, 서울 동대문구, completed_trips 3 → silver), 동행용 고객 `friend1@customer.com`, `friend2@customer.com` (비밀번호 demo1234, name 박동행, 이서연), 추가 고객 3명.
demo 계정에는 completed 예약 3건(과거 출발일)과 gathering 예약 1건을 미리 넣어 로그인 팝업·마이페이지가 바로 보이게 한다.

물품(inventory): `CPL-TEE` 커플 기념티 120 / `GNS-GIFT` 건강 인삼 기념품 80 / `GLF-BALL` 골프공 세트 200 / `GLF-ACC` 골프 액세서리 60 / `TRK-SCARF` 아웃도어 스카프 150 / `ROOM-DECO` 룸 데코 키트 40 / `MSG-VCHR` 안마·지압 이용권 90.
테마 perks: honeymoon → 커플 기념티(per_person 1), 룸 데코 키트(1). parents → 인삼 기념품(per_person 1), 안마 이용권(per_person 1). golf → 골프공 세트(per_person 1), 골프 액세서리(per_person 1). trekking → 스카프(per_person 1).

패키지 12개 (1인 가격 classic/grand/premium; 허니문·효도는 classic 없음 → `null`) — 이미지는 `hero_images` 에 `/images/packages/<slug>-1.jpg` 형식으로 3장씩 (파일은 통합 단계에서 채움):

| slug | 테마 | 제목 | 지역/국가 | 박/일 | classic | grand | premium |
|---|---|---|---|---|---|---|---|
| bali-honeymoon | honeymoon | 발리 우붓 & 스미냑 허니문 5일 | 발리/인도네시아 | 3/5 | — | 1,890,000 | 2,690,000 |
| santorini-honeymoon | honeymoon | 산토리니 이아 선셋 허니문 7일 | 산토리니/그리스 | 5/7 | — | 3,490,000 | 4,590,000 |
| jeju-honeymoon | honeymoon | 제주 프라이빗 풀빌라 허니문 3일 | 제주/대한민국 | 2/3 | — | 890,000 | 1,390,000 |
| kyushu-parents | parents | 규슈 온천 효도 힐링 4일 | 후쿠오카·벳부/일본 | 3/4 | — | 1,290,000 | 1,890,000 |
| zhangjiajie-parents | parents | 장가계 · 천문산 효도 여행 5일 | 장가계/중국 | 4/5 | — | 1,190,000 | 1,690,000 |
| gangwon-parents | parents | 강원 정선 · 강릉 힐링 효도 3일 | 강원/대한민국 | 2/3 | — | 590,000 | 890,000 |
| danang-golf | golf | 다낭 골프 챌린지 36홀 5일 | 다낭/베트남 | 3/5 | 1,090,000 | 1,390,000 | 1,990,000 |
| jeju-golf | golf | 제주 명문 골프장 라운딩 3일 | 제주/대한민국 | 2/3 | 690,000 | 890,000 | 1,290,000 |
| chiangmai-golf | golf | 치앙마이 골프 & 스파 5일 | 치앙마이/태국 | 3/5 | 1,190,000 | 1,490,000 | 2,090,000 |
| poonhill-trekking | trekking | 히말라야 푼힐 전망 트레킹 8일 | 포카라/네팔 | 6/8 | 1,690,000 | 2,090,000 | 2,790,000 |
| jirisan-trekking | trekking | 지리산 종주 트레킹 3일 | 지리산/대한민국 | 2/3 | 390,000 | 590,000 | 890,000 |
| hokkaido-trekking | trekking | 홋카이도 다이세츠산 트레킹 5일 | 홋카이도/일본 | 3/5 | 1,290,000 | 1,590,000 | 2,190,000 |

각 패키지: 출발일정 3~4개(오늘 기준 +2주 ~ +4개월 사이, capacity 10~20, 일부는 booked 6~9로 "잔여 적음"), 일차별 일정표(실제 지명 기반, 식사 조/중/석), 포함/불포함(여기어때식: 왕복항공권, 제세공과금, 여행자보험, 전용차량, 관광지 입장료 / 가이드·기사 경비, 개인경비, 싱글룸 사용료), highlights 3~4개, badges 일부(`인기`, `출발 확정 임박`, `신규`).
평점 rating 4.5~4.9, review_count 40~1200(표시용 정적값).

식사 추가옵션 meal_addons: 샴페인 1병 80,000 / 스페셜티 커피 12,000 / 와인 페어링 65,000 / 생일·기념일 케이크 45,000.

## 프론트 라우트 ↔ API 매핑 요약
- `/` → `/themes`, `/packages/featured`, `/catalog`
- `/themes/[slug]` → `/themes/{slug}`, `/packages?theme=`
- `/packages/[id]` → `/packages/{id}`, `/bookings/quote`(옵션 변경마다 debounce 300ms)
- `/booking/[packageId]?departure=&style=...` → quote → `POST /bookings` → `/pay` → `/booking/complete/[id]`
- `/join/[code]` → `/bookings/invite/{code}` → 로그인 → `POST /bookings/join`
- `/me` → `/me`, `/me/bookings`; 로그인 직후 `/me/trips` 팝업
- `/staff/*` → `/staff/*`
