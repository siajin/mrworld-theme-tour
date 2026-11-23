import type { BookingStatus, DepartureStatus, MealCode, StyleCode, TransportCode } from "./types";

export const won = (n: number | null | undefined) => (n == null ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`);
export const wonShort = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}`;

/** "2026-10-24" → "10.24(토)" */
export function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}.${d.getDate()}(${days[d.getDay()]})`;
}

/** "2026-10-24" → "2026.10.24" */
export function fullDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${fullDate(iso.slice(0, 10))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const duration = (nights: number, days: number) => `${nights}박 ${days}일`;

export const STYLE_LABEL: Record<StyleCode, string> = { classic: "클래식", grand: "그랜드", premium: "프리미엄" };
export const STYLE_DESC: Record<StyleCode, string> = {
  classic: "3성급 호텔 · 도시락",
  grand: "4성급 호텔 · 현지식 레스토랑",
  premium: "5성급 호텔 · 고급 레스토랑 스테이크 & 샴페인",
};
export const MEAL_LABEL: Record<MealCode, string> = {
  lunchbox: "도시락",
  local: "현지식 레스토랑",
  fine_dining: "고급 레스토랑 (스테이크 & 샴페인)",
};
export const TRANSPORT_LABEL: Record<TransportCode, string> = {
  sedan_2: "2인 전용 고급 세단",
  van_10: "10인승 고급 승합",
  limousine: "리무진",
  premium_bus_25: "25인승 프리미엄 버스",
};
export const HOTEL_LABEL = (g: number) => `${g}성급 호텔`;

export const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: "neutral" | "info" | "success" | "danger" | "muted" }> = {
  pending: { label: "결제 대기", tone: "neutral" },
  gathering: { label: "동행 모집 중", tone: "info" },
  confirmed: { label: "출발 확정", tone: "success" },
  cancelled: { label: "취소됨", tone: "danger" },
  completed: { label: "여행 완료", tone: "muted" },
};

export const DEPARTURE_STATUS: Record<DepartureStatus, string> = { open: "모집 중", closed: "마감", departed: "출발 완료" };

export const LOYALTY_LABEL = { basic: "베이직", silver: "실버 단골", gold: "골드 단골" } as const;

export function phoneFormat(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
