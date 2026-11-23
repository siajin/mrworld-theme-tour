// 고객 화면 공용 헬퍼 (lib/ 는 공용·동결이므로 고객 영역 전용 헬퍼는 여기에 둔다)
import type { Catalog, Departure, MealCode, Package, StyleCode, Theme, TransportCode } from "@/lib/types";

/** 예약 옵션 상태 — 상세 → 예약 플로우로 URL 쿼리로 이월된다 */
export interface BookingOptions {
  departureId: number | null;
  style: StyleCode;
  hotel: 3 | 4 | 5;
  meal: MealCode;
  transport: TransportCode;
  travelers: number;
  /** meal_addon_id → qty */
  addons: Record<number, number>;
}

export const STYLE_CODES: StyleCode[] = ["classic", "grand", "premium"];
export const MEAL_CODES: MealCode[] = ["lunchbox", "local", "fine_dining"];
export const TRANSPORT_CODES: TransportCode[] = ["sedan_2", "van_10", "limousine", "premium_bus_25"];

export const isStyleCode = (v: unknown): v is StyleCode => typeof v === "string" && (STYLE_CODES as string[]).includes(v);
export const isMealCode = (v: unknown): v is MealCode => typeof v === "string" && (MEAL_CODES as string[]).includes(v);
export const isTransportCode = (v: unknown): v is TransportCode =>
  typeof v === "string" && (TRANSPORT_CODES as string[]).includes(v);
export const isHotelGrade = (v: number): v is 3 | 4 | 5 => v === 3 || v === 4 || v === 5;

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 예약 가능한 출발일정: 모집 중 + 오늘 이후 */
export function openDepartures(departures: Departure[]) {
  const today = todayIso();
  return departures
    .filter((d) => d.status === "open" && d.depart_date >= today)
    .sort((a, b) => a.depart_date.localeCompare(b.depart_date));
}

/** 패키지에서 선택 가능한 첫 스타일 */
export function defaultStyle(pkg: Package): StyleCode {
  const first = pkg.style_prices.find((s) => s.available);
  return first?.style_code ?? "grand";
}

export function styleDefaults(catalog: Catalog, style: StyleCode): { hotel: 3 | 4 | 5; meal: MealCode } {
  const s = catalog.styles.find((x) => x.code === style);
  return { hotel: s?.hotel_grade ?? 4, meal: s?.meal_code ?? "local" };
}

// ── 도메인 규칙 (api-contract.md §핵심 도메인 규칙 — 백엔드 pricing.py 와 동일) ─────────────

/** 한 예약의 최대 인원 (스테퍼 상한). 출발일정 잔여 인원과 함께 min 을 취한다 */
export const MAX_TRAVELERS = 10;

export const MEAL_RANK: Record<MealCode, number> = { lunchbox: 1, local: 2, fine_dining: 3 };

/** 테마가 허용하는 가장 낮은 스타일. 세부 변경(호텔·식사)도 이 스타일의 기본값 아래로는 내려갈 수 없다 */
export interface OptionFloor {
  style: StyleCode;
  rank: number;
  hotel: 3 | 4 | 5;
  meal: MealCode;
}

/** theme.min_style_rank 로 하한을 정한다. 테마를 못 받았으면 패키지의 style_prices.available 로 추정 */
export function optionFloor(catalog: Catalog, pkg: Package | null, theme: Theme | null): OptionFloor {
  const styles = [...catalog.styles].sort((a, b) => a.rank - b.rank);
  let s = theme ? styles.find((x) => x.rank === theme.min_style_rank) : undefined;
  if (!s && pkg) {
    const first = pkg.style_prices.find((sp) => sp.available)?.style_code;
    s = styles.find((x) => x.code === first);
  }
  s ??= styles[0];
  return s
    ? { style: s.code, rank: s.rank, hotel: s.hotel_grade, meal: s.meal_code }
    : { style: "classic", rank: 1, hotel: 3, meal: "lunchbox" };
}

export const hotelAllowed = (grade: number, floor: OptionFloor) => grade >= floor.hotel;
export const mealAllowed = (meal: MealCode, floor: OptionFloor) => MEAL_RANK[meal] >= MEAL_RANK[floor.meal];

export function transportFits(catalog: Catalog, code: TransportCode, travelers: number) {
  const t = catalog.transport_options.find((x) => x.code === code);
  return !t || t.capacity >= travelers;
}

/** 인원이 탈 수 있는 가장 저렴한 차량. 요금이 같으면 테마 기본 차량 → 정원이 작은 순 */
export function cheapestTransportFor(catalog: Catalog, travelers: number, themeDefault?: TransportCode | null): TransportCode | null {
  const fits = catalog.transport_options.filter((t) => t.capacity >= travelers);
  fits.sort((a, b) => a.surcharge - b.surcharge || Number(b.code === themeDefault) - Number(a.code === themeDefault) || a.capacity - b.capacity);
  return fits[0]?.code ?? null;
}

/** 받침 유무에 따른 조사 ("밴으로" / "버스로", "투어는" / "세단은") */
export function particle(word: string, withFinal: string, withoutFinal: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return withoutFinal;
  const final = code % 28;
  if (final === 0) return withoutFinal;
  // "으로/로" 는 ㄹ 받침이면 "로"
  if (withFinal === "으로" && final === 8) return withoutFinal;
  return withFinal;
}

export function themeSubject(theme: Theme | null | undefined, fallback = "이 테마") {
  const name = theme?.name ?? fallback;
  return `${name}${particle(name, "은", "는")}`;
}

export function floorHotelMessage(theme: Theme | null | undefined, floor: OptionFloor) {
  return `${themeSubject(theme)} ${floor.hotel}성급 이상 호텔만 선택할 수 있어요`;
}

export function floorMealMessage(catalog: Catalog, theme: Theme | null | undefined, floor: OptionFloor) {
  const label = catalog.meal_options.find((m) => m.code === floor.meal)?.label ?? floor.meal;
  return `${themeSubject(theme)} ${label} 이상 식사만 선택할 수 있어요`;
}

export function transportSwitchMessage(catalog: Catalog, code: TransportCode) {
  const label = catalog.transport_options.find((t) => t.code === code)?.label ?? code;
  return `인원에 맞춰 차량을 ${label}${particle(label, "으로", "로")} 바꿨어요`;
}

export interface OptionAdjustment {
  field: "hotel" | "meal" | "transport" | "travelers";
  message: string;
  tone: "info" | "error";
}

/**
 * 옵션에 도메인 규칙을 적용한다: 스타일 변경 시 호텔·식사를 새 스타일 기본값으로,
 * 테마 하한 미만의 호텔·식사는 하한으로, 출발일 잔여 인원·차량 정원을 넘는 인원은 조정.
 * 바뀐 항목은 adjustments 로 돌려주어 화면에서 토스트로 이유를 보여 준다.
 */
export function applyOptionRules(
  catalog: Catalog,
  pkg: Package | null,
  theme: Theme | null,
  prev: BookingOptions,
  patch: Partial<BookingOptions>,
  departure?: Departure | null,
): { options: BookingOptions; adjustments: OptionAdjustment[] } {
  const next: BookingOptions = { ...prev, ...patch };
  const adjustments: OptionAdjustment[] = [];
  const floor = optionFloor(catalog, pkg, theme);

  // 스타일을 바꾸면 세부 변경(호텔·식사)은 새 스타일 기본값으로 되돌린다 (추가옵션·차량은 유지)
  if (patch.style && patch.style !== prev.style) {
    const d = styleDefaults(catalog, patch.style);
    next.hotel = d.hotel;
    next.meal = d.meal;
  }
  if (!hotelAllowed(next.hotel, floor)) {
    next.hotel = floor.hotel;
    adjustments.push({ field: "hotel", message: floorHotelMessage(theme, floor), tone: "error" });
  }
  if (!mealAllowed(next.meal, floor)) {
    next.meal = floor.meal;
    adjustments.push({ field: "meal", message: floorMealMessage(catalog, theme, floor), tone: "error" });
  }

  // 허니문은 차량과 무관하게 2인 전용. 다른 테마는 잔여 인원 내 최대 10명.
  const cap = maxTravelersFor(departure, theme ?? pkg?.theme);
  if (next.travelers > cap) {
    next.travelers = cap;
    adjustments.push({ field: "travelers", message: (theme ?? pkg?.theme)?.slug === "honeymoon" ? `허니문은 2인 전용으로 ${cap}명까지 선택할 수 있어요` : `잔여 인원에 맞춰 ${cap}명으로 바꿨어요`, tone: "info" });
  }
  if (next.travelers < 1) next.travelers = 1;

  // 차량 정원을 넘으면 인원이 타는 가장 저렴한 차량으로
  if (!transportFits(catalog, next.transport, next.travelers)) {
    const fit = cheapestTransportFor(catalog, next.travelers, theme?.default_transport);
    if (fit) {
      next.transport = fit;
      adjustments.push({ field: "transport", message: transportSwitchMessage(catalog, fit), tone: "info" });
    }
  }
  return { options: next, adjustments };
}

/** 허니문 2명, 다른 테마 10명 이내에서 출발일 잔여 인원까지 선택한다. */
export function maxTravelersFor(departure: Departure | null | undefined, theme?: Pick<Theme, "slug"> | null) {
  const limit = theme?.slug === "honeymoon" ? 2 : MAX_TRAVELERS;
  return departure ? Math.max(1, Math.min(limit, departure.remaining)) : limit;
}

export function initialOptions(pkg: Package, theme: Theme | null, catalog: Catalog): BookingOptions {
  const style = defaultStyle(pkg);
  const d = styleDefaults(catalog, style);
  // 기본 출발일 = 가장 이른 모집 중 · 잔여 있는 출발일정
  const dep = openDepartures(pkg.departures).find((x) => x.remaining > 0) ?? null;
  const base: BookingOptions = {
    departureId: dep?.id ?? null,
    style,
    hotel: d.hotel,
    meal: d.meal,
    transport: theme?.default_transport ?? "van_10",
    travelers: Math.max(1, theme?.min_travelers ?? 2),
    addons: {},
  };
  return applyOptionRules(catalog, pkg, theme, base, {}, dep).options;
}

export function serializeAddons(addons: Record<number, number>) {
  return Object.entries(addons)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${id}:${q}`)
    .join(",");
}

export function parseAddons(raw: string | null | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  if (!raw) return out;
  raw.split(",").forEach((pair) => {
    const [id, q] = pair.split(":");
    const i = Number(id);
    const n = Number(q);
    if (Number.isInteger(i) && i > 0 && Number.isInteger(n) && n > 0) out[i] = n;
  });
  return out;
}

export function addonsToRequest(addons: Record<number, number>) {
  return Object.entries(addons)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({ meal_addon_id: Number(id), qty: q }));
}

export function bookingHref(packageId: number, o: BookingOptions) {
  const p = new URLSearchParams();
  if (o.departureId) p.set("departure", String(o.departureId));
  p.set("style", o.style);
  p.set("hotel", String(o.hotel));
  p.set("meal", o.meal);
  p.set("transport", o.transport);
  p.set("travelers", String(o.travelers));
  const a = serializeAddons(o.addons);
  if (a) p.set("addons", a);
  return `/booking/${packageId}?${p.toString()}`;
}

/** URL 쿼리 → 옵션 (없거나 잘못된 값은 기본값) */
export function optionsFromParams(
  params: URLSearchParams,
  pkg: Package,
  theme: Theme | null,
  catalog: Catalog,
): BookingOptions {
  const base = initialOptions(pkg, theme, catalog);
  const style = params.get("style");
  const out: BookingOptions = { ...base };
  if (isStyleCode(style) && pkg.style_prices.some((s) => s.style_code === style && s.available)) {
    out.style = style;
    const d = styleDefaults(catalog, style);
    out.hotel = d.hotel;
    out.meal = d.meal;
  }
  const depId = Number(params.get("departure"));
  const dep = openDepartures(pkg.departures).find((d) => d.id === depId && d.remaining > 0) ?? null;
  if (dep) out.departureId = dep.id;
  const hotel = Number(params.get("hotel"));
  if (isHotelGrade(hotel)) out.hotel = hotel;
  const meal = params.get("meal");
  if (isMealCode(meal)) out.meal = meal;
  const transport = params.get("transport");
  if (isTransportCode(transport)) out.transport = transport;
  const travelers = Number(params.get("travelers"));
  if (Number.isInteger(travelers) && travelers >= 1 && travelers <= MAX_TRAVELERS) out.travelers = travelers;
  out.addons = parseAddons(params.get("addons"));
  // URL 을 손으로 고쳐도 테마 하한·차량 정원·잔여 인원 규칙은 그대로 적용된다
  const selected = dep ?? openDepartures(pkg.departures).find((d) => d.id === out.departureId) ?? null;
  return applyOptionRules(catalog, pkg, theme, out, {}, selected).options;
}

/** "10.12(월) 출발 · 잔여 6명" 등 카드 문구 */
export function remainingLabel(remaining: number) {
  if (remaining <= 0) return "마감";
  if (remaining <= 3) return `잔여 ${remaining}명`;
  return `잔여 ${remaining}명`;
}

export function ratingText(rating: number, count: number) {
  return `${rating.toFixed(1)} (${count.toLocaleString("ko-KR")})`;
}

/** 출발월 선택 옵션: 이번 달부터 6개월 */
export function monthOptions(count = 6) {
  const now = new Date();
  const out: { value: string; label: string; from: string; to: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, "0");
    out.push({
      value: `${y}-${mm}`,
      label: i === 0 ? `${m}월 (이번 달)` : `${y !== now.getFullYear() ? `${y}년 ` : ""}${m}월`,
      from: `${y}-${mm}-01`,
      to: `${y}-${mm}-${String(last).padStart(2, "0")}`,
    });
  }
  return out;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** "/login?next=..." */
export function loginHref(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}
