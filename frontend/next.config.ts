import type { NextConfig } from "next";

// 브라우저는 같은 출처(/api, /media)로만 호출하고, Next 서버가 백엔드로 넘겨준다.
// → CORS 문제 없음, 휴대폰(PWA)에서 PC IP 로 접속해도 그대로 동작.
const backend = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
    ];
  },
};

export default nextConfig;
