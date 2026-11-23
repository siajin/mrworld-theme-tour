# 프론트엔드 작업 규칙 (frontend/)

Next.js 16 (App Router, TypeScript), Tailwind v4 (CSS 기반 설정 — `tailwind.config` 없음, 토큰은 `app/globals.css` 의 `@theme inline`), lucide-react, clsx. 이미 `npm install` 되어 있고 `npx next build` 가 통과하는 상태.

## 이미 있는 것 — 반드시 재사용, 새로 만들지 말 것
- `lib/types.ts` — API 계약 타입 (docs/api-contract.md 와 1:1)
- `lib/api.ts` — `api.*` 호출 함수 전부, `ApiError`, `imageUrl()` (이미지 경로 → URL), 토큰 저장/갱신
- `lib/auth.tsx` — `AuthProvider`(루트 레이아웃에 이미 장착), `useAuth()` → `{user, loading, login, signup, logout, refresh, justLoggedIn, consumeJustLoggedIn}`
- `lib/format.ts` — `won()`, `shortDate()`, `fullDate()`, `dateTime()`, `duration()`, 라벨 상수 `STYLE_LABEL/STYLE_DESC/MEAL_LABEL/TRANSPORT_LABEL/HOTEL_LABEL/BOOKING_STATUS/DEPARTURE_STATUS/LOYALTY_LABEL`, `phoneFormat()`
- `components/ui/` — `Button`(variant primary/secondary/outline/ghost/danger, size sm/md/lg, loading, full), `Chip`+`ChipRow`, `Badge`(tone), `Card`+`SectionTitle`, `Field/Input/Textarea/Select/Checkbox`, `Modal`(모바일 바텀시트), `Tabs`+`Segmented`, `misc.tsx` 의 `Photo`(로드 실패 시 그라데이션 대체), `Skeleton`, `Accordion`, `Divider`, `EmptyState`, `Stepper`
- `components/ui/toast.tsx` — `useToast()` → `toast(message, "info"|"success"|"error")` (Provider 장착됨)
- `components/pwa-register.tsx` — 서비스워커 등록(장착됨), `promptInstall()`
- `public/manifest.json`, `public/sw.js`, `public/icons/`

Tailwind 색 클래스: `bg-primary text-primary bg-primary-soft text-primary-dark text-accent bg-bg bg-surface text-ink text-ink-2 text-muted text-muted-2 border-line border-line-strong bg-success-soft text-success bg-danger-soft text-danger bg-warning-soft text-warning`. 그림자: `shadow-[var(--shadow-card)]`, 라운드: `rounded-[var(--radius-card)]`.

## 디자인 원칙 (사용자 요구: 여기어때 UX + Wanderly UI, 깔끔하고 "AI 티" 안 나게)
- 흰 카드 + 연한 회색 배경, 파란 프라이머리 하나, 가격/할인만 주황. 그라데이션·이모지·장식용 아이콘 남발·과한 애니메이션 금지. 아이콘은 lucide 한 세트.
- 카피는 실제 여행사 문구처럼: "성인 1인 1,290,000원~", "예약금만 결제 가능", "최소출발 3명", "출발 확정". 감탄사·마케팅 수식어 남발 금지.
- 이미지는 `Photo` 컴포넌트로만 렌더 (파일이 없어도 깨지지 않음). 경로는 백엔드 시드가 주는 값 그대로 (`/images/packages/<slug>-1.jpg`, `/images/themes/<slug>.jpg`).
- 모바일 퍼스트. 고객 화면 컨테이너 `max-w-[1120px] mx-auto px-4`. 고객 헤더 높이 56px(모바일)/64px(데스크톱). 직원 화면은 데스크톱 기준(사이드바 240px).
- 모든 버튼/입력에 명확한 텍스트 라벨 또는 `aria-label` (2단계 음성 명령 매핑 대비).
- 데이터 fetch는 클라이언트 컴포넌트에서 `useEffect` + `api.*` 로(백엔드는 localhost:8000, SSR 시 접근 불가할 수 있으므로 서버 컴포넌트에서 fetch 하지 않는다). 로딩은 `Skeleton`, 에러는 `toast(err.message, "error")`.
- `"use client"` 는 필요한 파일에만. 페이지 파일은 얇게, 로직은 components/ 로.
- 라우트 파라미터: Next 16 에서 `params` 는 Promise → `use(params)` 또는 `await params`.
- 금액은 `won()`, 날짜는 `shortDate()`/`fullDate()`. 숫자 컬럼엔 `tabular` 클래스.
- ESLint/TS 에러 0 으로 유지: 작업 끝에 `npx tsc --noEmit && npx next build` 통과 필수.

## 파일 소유 (병렬 작업 충돌 방지)
- 고객 담당: `app/(customer)/**`, `app/(auth)/**`, `app/join/**`, `app/booking/**`, `components/customer/**`, `components/voice/**`
- 직원 담당: `app/staff/**`, `components/staff/**`
- 공용 `components/ui/**`, `lib/**` 은 수정하지 않는다. 꼭 필요한 공용 컴포넌트가 없으면 자기 영역 아래에 만든다.
