"use client";

import { ExternalLink, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageTitleFor } from "@/components/staff/lib";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";

export function Topbar({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const title = pageTitleFor(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
      <p
        className="truncate text-[16px] font-bold text-ink"
        aria-label="현재 화면"
      >
        {title}
      </p>
      <div className="flex items-center gap-1.5">
        <Link
          href="/"
          target="_blank"
          className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-ink-2 hover:bg-bg sm:inline-flex"
        >
          <ExternalLink className="size-4 text-muted" aria-hidden />
          고객 사이트 보기
        </Link>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <span className="inline-flex items-center gap-1.5 px-2 text-[13px] text-ink-2">
          <UserRound className="size-4 text-muted" aria-hidden />
          <span className="font-semibold">{user.name}</span>
          <span className="hidden text-muted md:inline">· {user.email}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          aria-label="로그아웃"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </Button>
      </div>
    </header>
  );
}
