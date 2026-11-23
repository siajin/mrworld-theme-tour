"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { VoiceButton } from "@/components/voice";
import { Logo } from "./logo";

const NAV = [
  { href: "/themes", label: "테마별 여행", match: (p: string) => p.startsWith("/themes") },
  { href: "/#events", label: "이벤트", match: () => false },
  { href: "/me", label: "내 예약", match: (p: string) => p.startsWith("/me") },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const toast = useToast();

  const onLogout = () => {
    logout();
    toast("로그아웃했어요");
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 md:h-16">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors",
                  active ? "text-primary" : "text-ink-2 hover:bg-bg hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* 데스크톱 음성 명령 (모바일은 하단 탭 바의 마이크) */}
          <span className="hidden md:inline-flex">
            <VoiceButton />
          </span>
          {loading ? (
            <span className="h-9 w-20 animate-pulse rounded-lg bg-line" aria-hidden />
          ) : user ? (
            <>
              <Link
                href={user.role === "staff" ? "/staff" : "/me"}
                aria-label="마이페이지"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pl-1 pr-3 text-[14px] font-semibold text-ink hover:bg-bg"
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary">
                  {user.name.slice(0, 1)}
                </span>
                <span>{user.name}</span>
              </Link>
              <button
                type="button"
                onClick={onLogout}
                aria-label="로그아웃"
                className="hidden size-9 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-ink md:inline-flex"
              >
                <LogOut className="size-[18px]" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-btn)] px-3 text-[14px] font-semibold text-ink-2 hover:bg-bg"
              >
                <UserRound className="size-4 md:hidden" aria-hidden />
                로그인
              </Link>
              <Link
                href="/signup"
                className="hidden h-9 items-center rounded-[var(--radius-btn)] bg-primary px-3.5 text-[14px] font-semibold text-white hover:bg-primary-hover md:inline-flex"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
