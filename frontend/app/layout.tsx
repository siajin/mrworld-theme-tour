import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "미스터 월드 테마 투어",
    template: "%s | 미스터 월드",
  },
  description:
    "허니문·효도·골프·트레킹, 테마별 맞춤 여행 패키지. 특별한 날 가장 멋있는 장소에서 사랑하는 사람에게 잊지 못할 여행의 감동을 선물하세요.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "미스터 월드" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* Pretendard: 사용자 브라우저에서 CDN 로드, 실패 시 시스템 폰트로 대체 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
