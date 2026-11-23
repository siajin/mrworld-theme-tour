import Link from "next/link";
import { Lock } from "lucide-react";
import { VoiceButton, VoiceProvider } from "@/components/voice";
import { Logo } from "./logo";

/** 예약 플로우 · 초대 합류용 간소 셸 (하단 탭 바 없음, 집중 모드). 음성 명령은 헤더의 마이크로. */
export function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <VoiceProvider>
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 md:h-16">
          <Logo />
          <div className="flex items-center gap-4 text-[13px] text-muted">
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <Lock className="size-3.5" aria-hidden />
              안전한 예약
            </span>
            <Link href="/" className="font-semibold text-ink-2 hover:text-ink">
              홈으로
            </Link>
            <VoiceButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface py-6 text-center text-[12px] text-muted-2">
        고객센터 1588-0000 · 평일 09:00–18:00 · (주)미스터 월드 여행사
      </footer>
    </div>
    </VoiceProvider>
  );
}
