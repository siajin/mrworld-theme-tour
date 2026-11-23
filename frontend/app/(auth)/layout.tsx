import Link from "next/link";
import { Logo } from "@/components/customer/logo";

/** 인증 화면 셸: 연한 배경 위 가운데 카드 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between px-4 md:h-16">
        <Logo />
        <Link href="/" className="text-[14px] font-semibold text-muted hover:text-ink">
          홈으로
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 md:items-center md:pt-0">{children}</main>
      <footer className="pb-8 text-center text-[12px] text-muted-2">
        고객센터 1588-0000 · 평일 09:00–18:00 · © 2026 Mr. World Travel
      </footer>
    </div>
  );
}
