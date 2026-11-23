# 미스터 월드 테마 투어 — 백엔드 (FastAPI)

테마 패키지 여행 예약 서비스의 API 서버입니다. 프론트엔드(Next.js)와 공유하는 계약은 `../docs/api-contract.md` 이며, 이 코드는 그 문서를 그대로 구현합니다.

- Python 3.11 / FastAPI / SQLAlchemy 2.x / SQLite(`data/app.db`) / Alembic / JWT
- Base URL: `http://localhost:8000/api/v1`, Swagger: `http://localhost:8000/docs`
- 업로드 이미지: `media/` 폴더를 `/media` 로 정적 서빙

## 실행 (Windows)

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.db.seed
uvicorn app.main:app --reload --port 8000
```

macOS / Linux 는 `source .venv/bin/activate` 만 다릅니다.

- 서버가 뜨면 `data/app.db` 가 없어도 테이블을 자동으로 만듭니다(`create_all` + alembic head stamp). 마이그레이션을 직접 돌리려면 `alembic upgrade head`.
- 시드는 멱등입니다. 데이터를 처음부터 다시 만들려면 `python -m app.db.seed --reset`.
- 환경 변수는 `.env.example` 을 `.env` 로 복사해 수정합니다(없어도 기본값으로 동작).

## 시드 계정

| 역할 | 이메일 | 비밀번호 | 비고 |
|---|---|---|---|
| 직원 | admin@mrworld.com | admin1234 | 김운영 |
| 고객 | demo@customer.com | demo1234 | 시아진, 완료 여행 3회(silver), 동행 모집 중 예약 1건(초대 코드 `MWJOIN01`) |
| 고객 | friend1@customer.com | demo1234 | 박동행 — 초대 코드로 합류 테스트용 |
| 고객 | friend2@customer.com | demo1234 | 이서연 |

시드에는 테마 4종, 상품 12개(출발일정 3~4개씩), 창고 물품 7종, 식사 추가옵션 4종, 다른 고객들의 확정 예약과 알림·출고 이력이 들어 있습니다.

## 테스트

```bat
python -m pytest -q
```

임시 SQLite 파일을 만들어 전체 시드를 넣고 API 를 호출합니다. 가격 공식, 예약 상태 전이(pending → gathering → confirmed), 동행 합류, 알림·출고, 직원 권한/CRUD 를 검증합니다.

## 구조

```
app/
├─ main.py            앱 생성, CORS, /media, 라우터 등록
├─ core/              config(pydantic-settings), security(JWT·bcrypt), deps(인증·직원 권한)
├─ db/                session, base(create_schema), seed
├─ models/            SQLAlchemy 모델 (users, themes, packages, departures, bookings, inventory, notifications, settings …)
├─ schemas/           Pydantic 요청/응답 — api-contract.md 의 TS 타입과 1:1
├─ services/          pricing(가격 공식), booking(상태 기계), inventory(출고), notification(SMS provider), loyalty, ai(규칙 파서), presenters(응답 변환)
└─ api/v1/            auth, me, catalog, themes, packages, bookings, ai, staff_*
alembic/              마이그레이션 (0001_initial_schema)
tests/                pytest
```

## 핵심 규칙 요약

- 확정 여부는 **예약 1건(대표자 + 동행)의 인원**으로만 판단합니다. 허니문 2명, 그 외 3명(테마의 `min_travelers`). 다른 예약과 합산하지 않습니다.
- `POST /bookings` → `pending` → `POST /bookings/{id}/pay` → 인원 충족 시 `confirmed`, 미달 시 `gathering` + 8자리 `invite_code`. 동행이 `POST /bookings/join` 하면 인원 +1, 견적 재계산, 충족 시 `confirmed`.
- 기본 제공 구성은 예약 때 보존합니다. 견적·예약 생성·결제·직원 확정에서 재고가 부족하면 진행을 차단합니다. 결제 완료(모집 중 포함) 또는 직원 확정 시 연결 물품을 차감하고, 인원 변경 시 차이만 조정하며 취소 시 실제 차감분을 복원합니다. 중복 물품은 합산하고 동시 요청은 원자적으로 처리합니다.
- 알림은 `sms` 채널로 DB에 기록합니다. 기본 console은 발송하지 않으며, Solapi 설정 시 실제 SMS로 발송합니다.
- 가격: `services/pricing.py` 의 공식 그대로. 허니문·효도는 그랜드 이상만 선택 가능(400).

허니문 낭만 투어는 차량 종류와 관계없이 예약 1건당 최대 2명이다. 상품·예약 화면과 URL·음성 인원 처리에 같은 상한을 적용하고, 서버도 3명 이상 견적·예약·동행 추가·결제·직원 확정을 거절한다.
