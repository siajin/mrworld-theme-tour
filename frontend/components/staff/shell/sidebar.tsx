"use client";

import { clsx } from "clsx";
import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STAFF_NAV, isNavActive } from "@/components/staff/lib";

/** 좌측 사이드바. lg 미만에서는 아이콘만 표시(64px). */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-line bg-surface lg:w-60">
      <Link
        href="/staff"
        className="flex h-14 items-center gap-2.5 border-b border-line px-3 lg:px-5"
        aria-label="미스터 월드 Admin 홈"
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <Globe className="size-4.5" aria-hidden />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-[15px] font-bold leading-tight text-ink">
            미스터 월드
          </span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Admin
          </span>
        </span>
      </Link>

      <nav
        className="flex-1 overflow-y-auto px-2 py-3 lg:px-3"
        aria-label="관리 메뉴"
      >
        <ul className="space-y-0.5">
          {STAFF_NAV.map((item) => {
            const active = isNavActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={clsx(
                    "flex h-10 items-center justify-center gap-3 rounded-lg px-0 text-[14px] font-semibold transition-colors lg:justify-start lg:px-3",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-ink-2 hover:bg-bg hover:text-ink",
                  )}
                >
                  <Icon
                    className={clsx(
                      "size-[18px] shrink-0",
                      active ? "text-primary" : "text-muted",
                    )}
                    aria-hidden
                  />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden border-t border-line px-5 py-3 text-[11px] leading-relaxed text-muted-2 lg:block">
        미스터 월드 테마 투어 운영 콘솔
        <br />
        1단계 · 내부용
      </div>
    </aside>
  );
}
