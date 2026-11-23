# components/voice — 음성 명령 (2단계: 실제 연결)

고객 화면 어디서나 마이크를 누르고 말하면 **Web Speech API → `/ai/parse` → 확인 → 실행** 으로 이어집니다.
검색뿐 아니라 "두 번째 상품", "그랜드로 바꿔", "3명으로", "가장 빠른 출발일로", "예약해줘", "뒤로" 같은
화면 조작 명령까지 처리합니다.

## 구성

| 파일 | 역할 |
|---|---|
| `voice-provider.tsx` | **`VoiceProvider`** — 흐름 전체를 소유하는 Context. 고객 셸(`customer-shell.tsx`)과 예약 셸(`checkout-shell.tsx`)에 한 번씩 마운트. `useVoice()`, `useVoiceOptional()`, `useVoiceContext()` 제공. 시트 3종도 여기서 렌더링. |
| `use-speech-recognition.ts` | `window.SpeechRecognition ?? webkitSpeechRecognition` 래퍼 훅. ko-KR, interimResults, 한 문장 인식, 8초 침묵 시 자동 종료, 오류 코드 → 한국어 메시지. |
| `voice-button.tsx` | 마이크 버튼 (`inline` / `fab`). 클릭 → `useVoice().open()`. 미지원 브라우저면 토스트. 듣는 중이면 `.voice-ring` 링 애니메이션. |
| `voice-listening-sheet.tsx` | "듣고 있어요…" 시트. 중간 인식 결과 표시, `processing` 이면 "알아듣는 중…". |
| `voice-confirm-sheet.tsx` | 확인 시트. 백엔드의 `result.reply`("허니문 · 2명(으)로 검색할까요?")를 그대로 묻고, 검색 의도면 테마/지역/시기/인원/스타일 칩 표시. `mode="unknown"` 이면 "다시 말하기 / 닫기"만. |
| `voice-help-sheet.tsx` | "도움말" 의도: 예시 문장 목록. |
| `search-href.ts` | `AIParseResult` → `/search?theme=…&summary=…&said=…`. 홈의 "이렇게 말해보세요" 힌트 칩도 같은 함수를 씁니다. |

마이크 버튼이 마운트된 곳: 홈 검색 카드(인라인), 모바일 하단 탭 바(FAB), 데스크톱 헤더(로그인 옆), 상품 상세 하단 고정 바(가격 왼쪽), 예약 플로우 헤더.

## 흐름

```
VoiceButton.onClick → useVoice().open()
  → useSpeechRecognition.start()            state: listening   (VoiceListeningSheet, interim 표시)
  → onFinal(text)                            state: processing  ("알아듣는 중…")
  → api.ai.parse(text, context)              context = 현재 화면 (home | search | theme | package | booking | me | other)
  → intent 에 따라
      go_back / go_home / my_bookings  → 즉시 실행 (확인 없음, 토스트로 안내)
      help                             → VoiceHelpSheet
      unknown                          → VoiceConfirmSheet(mode="unknown"): 다시 말하기 / 닫기
      그 외                            → VoiceConfirmSheet: result.reply + "네" / "다시"
  → "네" → execute(result)
      search → router.push(searchHrefFromParse(result, transcript))
      나머지 → 등록된 화면 처리기(handler) 순서대로 호출, 아무도 true 를 돌려주지 않으면
               토스트 "이 화면에서는 쓸 수 없는 명령이에요"
```

오류 처리: 권한 거부(`not-allowed`)·`no-speech`·`network`·`audio-capture` 는 훅이 한국어 메시지로 바꿔 `onError` 로 넘기고,
Provider 가 토스트를 띄운 뒤 시트를 닫습니다. 시트를 닫거나 "다시"를 누르면 세션 번호가 올라가서 늦게 도착한 파싱 결과는 무시됩니다.

## 화면 처리기 등록

각 페이지 컴포넌트가 마운트되는 동안 자기 컨텍스트와 처리기를 등록합니다. 언마운트 시 자동 해제되고 컨텍스트는 `other` 로 돌아갑니다.
`handle` 은 매 렌더의 최신 클로저를 참조하므로 페이지 state(`options`, `departures` 등)를 그대로 써도 됩니다.

```tsx
import { useVoiceContext } from "@/components/voice";

useVoiceContext("package", (result, transcript) => {
  if (result.intent === "set_style" && result.style_code) {
    update({ style: result.style_code });      // UI 버튼과 같은 setState → 같은 quote 재조회
    toast("그랜드 스타일로 바꿨어요", "success");
    return true;                               // 처리 완료
  }
  return false;                                // 이 화면에서 못 쓰는 명령 → Provider 가 안내 토스트
});
```

목록 화면(홈·검색·테마)은 `components/customer/voice-handlers.ts` 의 `useListVoiceCommands(context, items)` 를 씁니다
("n번째 상품" → 상세 이동, "예약해줘" → "먼저 상품을 골라 주세요").

| 화면 | context | 처리하는 intent |
|---|---|---|
| 홈 `home-page.tsx` | `home` | `select_result` (지금 인기 패키지 카드 6개 기준) |
| 검색 `search-page.tsx` | `search` | `select_result`, `book`(안내만) |
| 테마 `theme-detail-page.tsx` | `theme` | `select_result`, `book`(안내만) |
| 상품 상세 `package-detail-page.tsx` | `package` | `set_style`(테마 허용 스타일 검사), `set_travelers`(1~10, 잔여 인원 이내), `set_departure`(날짜 / earliest·next·last), `set_hotel`, `set_meal`(세부 변경 아코디언 펼침), `book`(예약하기 버튼과 동일) |
| 예약 플로우 `booking-flow.tsx` | `booking` | `set_travelers` (1단계에서만) |
| 내 예약 `me-page.tsx` | `me` | 없음 (전역만) |

전역(Provider): `search`, `go_back`, `go_home`, `my_bookings`(로그아웃 상태면 `/login?next=/me`), `help`.

## intent 표 (`POST /api/v1/ai/parse {text, context}`)

| intent | slots / 필드 | 예시 발화 |
|---|---|---|
| `search` | `theme_slug, region, depart_from/to, travelers_count, style_code, budget_max, matched_package_ids` | "부모님이랑 10월에 온천", "둘이서 로맨틱하게 5일" |
| `select_result` | `slots.index` (1부터, -1 = 마지막) | "두 번째 상품", "마지막 거" |
| `set_style` | `style_code` | "그랜드로 바꿔", "프리미엄으로" |
| `set_travelers` | `travelers_count` | "3명으로", "인원 4명" |
| `set_departure` | `slots.depart_date` 또는 `slots.departure_pick` (earliest/next/last) | "11월 2일 출발로", "가장 빠른 출발일로", "다음 출발일" |
| `set_hotel` | `slots.hotel_grade` (3/4/5) | "5성 호텔로" |
| `set_meal` | `slots.meal_code` | "고급 레스토랑으로", "도시락으로" |
| `book` | — | "예약해줘", "예약하기" |
| `go_back` / `go_home` / `my_bookings` | — | "뒤로", "홈으로", "내 예약" |
| `help` | — | "도움말", "뭐라고 말해" |
| `unknown` | `reply` 에 안내 문장 | — |

응답의 `reply` 는 확인 시트에 그대로 쓰는 문장("인원을 3명으로 바꿀까요?")입니다.

## 테스트 (헤드리스)

Web Speech API 는 헤드리스 브라우저에서 동작하지 않으므로, Playwright 에서는 `page.add_init_script` 로
`window.SpeechRecognition` 을 가짜 클래스로 바꿔 `start()` 300ms 뒤 정해진 문장을 `onresult(isFinal=true)` 로 흘려보내 파이프라인을 검증합니다
(`docs/screens/phase2-*.png` 참고). 미지원 경로는 `SpeechRecognition`/`webkitSpeechRecognition` 을 지운 뒤 마이크를 눌러 토스트를 확인합니다.

## 참고

- 키보드 단축키는 두지 않습니다 (입력창과 충돌).
- 서버 Whisper 로 바꾸려면 `use-speech-recognition.ts` 만 교체하면 됩니다 (`onFinal(text)` 계약 유지).
- 백엔드 `voice_sessions` 테이블에 인식 원문·파싱 결과를 남기면 파서 개선에 쓸 수 있습니다.

## 대화형 음성 예약

상단 `음성 예약` 버튼은 `VoiceBookingDialog`를 연다. `/ai/conversation`에 발화와 선택 상태를 보내 추천·기념일·테마·스타일·추가옵션을 이어서 정한다. 안내 음성이 끝난 뒤 마이크를 열며, 인식 실패나 미지원 브라우저에서는 같은 대화를 문자 입력으로 계속한다.

실제 출발 일정과 전체 금액·예약금을 확인한 뒤 마지막으로 동의하면 기존 견적·예약 생성·모의 결제 API로 처리한다. 결제 실패 시 생성된 예약 번호를 유지해 재시도한다. 대표자 이름·전화는 로그인 회원정보를 쓰고, 동행은 임시 표시명과 빈 연락처로 등록한다. 식사 추가옵션 수량은 기존 예약과 같이 1인 기준이다.
