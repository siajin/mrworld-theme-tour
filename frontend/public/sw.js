// 최소 서비스워커: 설치 가능(installable) 조건을 만족시키고 아이콘·사진·manifest 만 캐시한다.
// /_next/* 와 /api/* 는 절대 캐시하지 않는다 (개발 서버 HMR·최신 데이터 보장).
const CACHE = "mrworld-shell-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const cacheable =
    (url.origin === self.location.origin && (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json")) ||
    url.hostname === "images.unsplash.com";
  if (!cacheable) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
