"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { CalendarCheck, Home, LayoutGrid, UserRound } from "lucide-react";
import { VoiceButton } from "@/components/voice";

const LEFT = [
  { href: "/", label: "홈", icon: Home, match: (p: string) => p === "/" },
  { href: "/themes", label: "테마", icon: LayoutGrid, match: (p: string) => p.startsWith("/themes") },
];
const RIGHT = [
  { href: "/me", label: "내 예약", icon: CalendarCheck, match: (p: string) => p.startsWith("/me") },
  { href: "/login", label: "마이", icon: UserRound, match: (p: string) => p.startsWith("/login") },
];

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors",
        active ? "text-primary" : "text-muted hover:text-ink-2",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
      {label}
    </Link>
  );
}

/** 모바일 하단 탭 바. 가운데는 음성 명령 버튼. */
export function MobileTabBar({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  // 상품 상세는 자체 하단 예약 바를 쓰므로 탭 바를 숨긴다
  if (pathname.startsWith("/packages/")) return null;
  const right = RIGHT.map((t) => (t.label === "마이" && loggedIn ? { ...t, href: "/me", match: () => false } : t));

  return (
    <nav
      aria-label="모바일 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
    >
      <div className="safe-bottom flex items-stretch px-2 pt-1">
        {LEFT.map((t) => (
          <TabLink key={t.href} {...t} active={t.match(pathname)} />
        ))}
        <div className="flex w-[72px] items-start justify-center">
          <div className="-mt-5">
            <VoiceButton variant="fab" />
          </div>
        </div>
        {right.map((t) => (
          <TabLink key={t.label} {...t} active={t.match(pathname)} />
        ))}
      </div>
    </nav>
  );
}
