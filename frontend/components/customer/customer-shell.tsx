"use client";

import { useAuth } from "@/lib/auth";
import { VoiceProvider } from "@/components/voice";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { MobileTabBar } from "./mobile-tab-bar";
import { TripsPopup } from "./trips-popup";

/** 고객 화면 공통 셸: 음성 명령 Provider + 헤더 + 본문 + 푸터 + (모바일) 하단 탭 바 + 로그인 직후 팝업 */
export function CustomerShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <VoiceProvider>
      {/* 모바일 하단 탭 바(약 64px + safe-area)에 푸터까지 가리지 않도록 아래 여백 */}
      <div className="flex min-h-dvh flex-col pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <MobileTabBar loggedIn={!!user} />
        <TripsPopup />
      </div>
    </VoiceProvider>
  );
}
