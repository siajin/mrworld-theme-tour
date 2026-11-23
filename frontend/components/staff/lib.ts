// 직원 화면 공용 유틸 (components/staff 전용)
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  Users,
  Warehouse,
} from "lucide-react";

export function errMsg(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "요청에 실패했어요";
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 상세 라우트 제목 (prefix 매칭) */
  children?: { match: RegExp; title: string }[];
}

export const STAFF_NAV: NavItem[] = [
  { href: "/staff", label: "대시보드", icon: LayoutDashboard },
  {
    href: "/staff/packages",
    label: "상품 관리",
    icon: Package,
    children: [
      { match: /^\/staff\/packages\/new$/, title: "새 상품 등록" },
      { match: /^\/staff\/packages\/\d+$/, title: "상품 수정" },
    ],
  },
  { href: "/staff/themes", label: "테마 관리", icon: Tags },
  { href: "/staff/departures", label: "출발일정", icon: CalendarDays },
  { href: "/staff/inventory", label: "물품 창고", icon: Warehouse },
  { href: "/staff/bookings", label: "예약 관리", icon: BookOpen },
  {
    href: "/staff/customers",
    label: "고객 관리",
    icon: Users,
    children: [{ match: /^\/staff\/customers\/\d+$/, title: "고객 상세" }],
  },
  { href: "/staff/notifications", label: "알림 로그", icon: Bell },
  { href: "/staff/settings", label: "설정", icon: Settings },
];

export function pageTitleFor(pathname: string): string {
  for (const item of STAFF_NAV) {
    for (const c of item.children ?? []) if (c.match.test(pathname)) return c.title;
  }
  const hit = [...STAFF_NAV]
    .filter((n) => (n.href === "/staff" ? pathname === "/staff" : pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.label ?? "Admin";
}

export function isNavActive(href: string, pathname: string) {
  return href === "/staff" ? pathname === "/staff" : pathname.startsWith(href);
}

/** "2026-10-08" + n일 → "2026-10-xx" */
export function addDays(iso: string, n: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return addDays(new Date().toISOString().slice(0, 10), 0);
}

/** "2026-10" → "2026년 10월" */
export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

export const THEME_ICONS = [
  "heart",
  "hand-heart",
  "flag",
  "mountain",
  "sun",
  "ship",
  "tent",
  "camera",
  "utensils",
  "waves",
  "snowflake",
  "sparkles",
] as const;
export type ThemeIconName = (typeof THEME_ICONS)[number];
