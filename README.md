# 미스터 월드 테마 투어 (Mr. World Theme Tour)

소프트웨어공학 프로젝트 — AI 기반 테마별 맞춤 여행 패키지 예약 서비스.
고객 인터페이스(웹 + 설치형 PWA 앱)와 직원 인터페이스(웹), 그리고 실제로 동작하는 백엔드(FastAPI + SQLite)로 구성됩니다.

```
소공/
├─ backend/     FastAPI · SQLAlchemy · SQLite (API + DB + 시드 + 테스트)
├─ frontend/    Next.js 16 · Tailwind (고객 웹/앱 = / , 직원 웹 = /staff)
├─ docs/        개발계획.md · api-contract.md · frontend-guide.md · screens/(화면 캡처)
├─ start-all.bat                 Windows: 백엔드+프론트 한 번에 실행 (개별: start-backend.bat / start-frontend.bat)
├─ install-on-phone.bat          USB 로 연결한 안드로이드 폰에 앱(PWA) 설치 (adb reverse → 폰에서 localhost:3000 열기)
└─ README.md
```

## 1. 준비물

- Python 3.11 이상 (`python --version`)
- Node.js 20 이상 (`node --version`) — https://nodejs.org (LTS)
- 인터넷 연결 (상품 사진은 Unsplash 원본을 브라우저가 직접 불러옵니다. 폰트도 CDN)

## 2. 실행 (Windows)

`start-all.bat` 을 더블클릭하면 창 두 개(백엔드·프론트)가 뜹니다. 처음 한 번은 venv/pip/npm install 이 자동으로 돌아 몇 분 걸립니다. 수동으로 하려면 아래처럼 터미널 두 개로 실행합니다.

**터미널 1 — 백엔드** (`start-backend.bat` 더블클릭과 동일)
```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.db.seed
uvicorn app.main:app --reload --port 8000
```
→ http://localhost:8000/docs (Swagger)

**터미널 2 — 프론트엔드** (`start-frontend.bat` 과 동일)
```bat
cd frontend
npm install
npm run dev
```
→ 고객: http://localhost:3000 · 직원: http://localhost:3000/staff

브라우저는 같은 출처의 `/api/v1` 만 호출하고 Next 서버가 `frontend/.env.local` 의 `BACKEND_ORIGIN`(기본 127.0.0.1:8000)으로 넘겨주므로 CORS 설정이 필요 없고, 휴대폰에서 PC IP 로 접속해도 그대로 동작합니다.

처음 한 번만 `venv`/`pip install`/`npm install` 이 필요하고, 이후엔 `uvicorn …` 과 `npm run dev` 만 실행하면 됩니다.

## 2-1. 휴대폰에 앱으로 설치

PWA 설치는 https 또는 localhost 에서만 되므로, 안드로이드 폰을 USB 로 연결하고(개발자 옵션 → USB 디버깅 켜기) `install-on-phone.bat` 을 실행하면 `adb reverse` 로 폰의 localhost:3000 이 이 PC 로 연결되고 폰 브라우저가 자동으로 열립니다. 폰 Chrome 메뉴에서 "앱 설치" 또는 "홈 화면에 추가"를 누르면 됩니다. 케이블을 다시 꽂으면 스크립트를 한 번 더 실행하세요. (아이폰은 adb 가 없어 Tailscale/ngrok 같은 https 주소가 필요합니다.)

## 3. 시연 계정

| 역할 | 이메일 | 비밀번호 | 비고 |
|---|---|---|---|
| 직원 | admin@mrworld.com | admin1234 | /staff 에서 로그인 |
| 고객(대표) | demo@customer.com | demo1234 | 완료 여행 3회(실버 단골 5% 할인), 동행 모집 중 예약 1건 · 초대 코드 `MWJOIN01` |
| 고객(동행) | friend1@customer.com | demo1234 | `/join/MWJOIN01` 로 합류 테스트 |
| 고객(동행) | friend2@customer.com | demo1234 | |

데이터를 처음 상태로 되돌리려면 백엔드에서 `python -m app.db.seed --reset`.

## 4. 시연 시나리오 (5분)

1. **직원** `/staff` 로그인 → 대시보드 → 상품 관리에서 상품 하나 열어 출발일정·스타일별 가격 확인 → 물품 창고에서 재고 확인.
2. **고객** 홈에서 테마 아이콘(허니문/효도/골프/트레킹) 또는 검색 카드로 상품 탐색 → "이렇게 말해보세요" 칩(자연어 검색, 음성인식 자리) 클릭.
3. 상품 상세 → 출발일 선택 → 스타일(클래식/그랜드/프리미엄) → "세부 변경"에서 호텔 등급·교통·식사·추가옵션 바꾸며 가격 실시간 변동 확인 → 예약하기.
4. 로그인(demo) → **지난 여행 팝업** 확인 → 예약 4단계 → 인원 2명으로 결제 → `동행 모집 중` + 초대 코드 발급 → 기본 제공 2명분 재고 차감.
5. 다른 브라우저(시크릿)에서 friend1 로 `/join/코드` 합류 → 3명 도달 → **출발 확정** → 직원 `/staff/notifications` 에서 문자 알림 기록, `/staff/inventory` 에서 합류한 1명분 추가 차감 확인. 취소하면 해당 예약의 실제 차감분이 복원된다.

## 5. 핵심 규칙 (요구사항 대응)

- 테마 4종(허니문·효도·골프·트레킹)과 투어 등급 스타일 3종(클래식 3성/도시락 · 그랜드 4성/현지식 · 프리미엄 5성/스테이크&샴페인). 허니문·효도는 그랜드 이상만.
- 스타일 선택 후 **호텔 등급·교통·식사를 개별 변경** 가능, 식사 추가옵션(샴페인·커피 등) 지원. 가격 공식은 `docs/api-contract.md`.
- 예약은 **대표자 + 동행(같이 가는 사람) 인원**이 테마 최소 인원(기본 3명, 허니문 2명)에 도달하면 확정. 미달이면 초대 코드로 동행을 모집. 확정 시 문자 알림(1단계: DB 기록).
- 가입 시 성명·주소·연락처 저장, 완료 여행 횟수로 단골 할인(실버 5%·골드 10%, 직원 설정에서 변경).
- 로그인하면 이전 여행 목록(최근순, 상품·기간·등급·가격)을 팝업으로 표시.
- 직원: 상품·테마·출발일정 CRUD, 물품 창고(입고/출고/조정, 결제·직원 확정 시 자동 차감과 취소·인원 변경 시 조정), 예약·고객·알림·설정 관리.
- 음성인식(2단계 완료): 마이크 버튼 → 브라우저 Web Speech API(ko-KR) → `POST /ai/parse {text, context}` → 의도(intent) 판별 → 확인 시트 → 실행. 검색("부모님이랑 10월에 온천"), 목록 선택("두 번째 상품"), 상세 조작("그랜드로", "3명으로", "가장 빠른 출발일로", "5성 호텔로", "식사는 스테이크로"), 예약("예약해줘"), 이동("내 예약", "홈으로", "뒤로")을 지원. Chrome/Edge 에서 동작(인식은 브라우저가 처리, 인터넷 필요). 구조는 `frontend/components/voice/README.md`.
- 문자 발송(2단계 완료): `backend/.env` 에 `SMS_PROVIDER=solapi`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SMS_FROM`(등록 발신번호)을 넣고 백엔드를 재시작하면 CoolSMS(Solapi)로 실제 발송. 키가 없으면 지금처럼 기록만. 직원 화면 알림 로그에서 현재 상태 확인·테스트 발송·실패 건 재발송 가능.

## 6. 문서

- `docs/개발계획.md` — 범위·아키텍처·데이터 모델·화면 설계
- `docs/api-contract.md` — API 명세(요청/응답, 가격·확정 규칙, 시드 데이터)
- `docs/screens/` — 고객/직원 화면 캡처(데스크톱·모바일)
- `backend/README.md`, `frontend/README.md`

## 7. 테스트

```bat
cd backend && python -m pytest -q      (46 tests: 음성 의도 파서, Solapi provider, 가격 공식, 예약 상태 전이, 동행 합류, 창고, 직원 권한)
cd frontend && npx tsc --noEmit && npm run build
```

허니문 낭만 투어는 차량 종류와 관계없이 예약 1건당 최대 2명이다. 상품·예약 화면과 URL·음성 인원 처리에 같은 상한을 적용하고, 서버도 3명 이상 견적·예약·동행 추가·결제·직원 확정을 거절한다.
