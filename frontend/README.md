# 미스터 월드 — 프론트엔드 (Next.js)

- 고객 웹/앱: `/` (모바일에서는 "홈 화면에 추가"로 설치되는 PWA)
- 직원 웹: `/staff`
- 백엔드 주소는 `.env.local` 의 `NEXT_PUBLIC_API_BASE` (기본 `http://localhost:8000/api/v1`)

```bat
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # 프로덕션 빌드 (서비스워커는 이 모드에서만 등록)
```

구조와 규칙은 `../docs/frontend-guide.md`, 음성인식 확장 방법은 `components/voice/README.md`.
오프라인 시연이 필요하면 `node scripts/fetch-images.mjs` 로 사진을 `public/images/` 에 내려받고 백엔드를 `USE_LOCAL_IMAGES=1` 로 다시 시드합니다.
