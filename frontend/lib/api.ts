// 백엔드 호출 클라이언트. 토큰은 localStorage("mw_tokens")에 보관하고 401이면 refresh 후 1회 재시도한다.
import type {
  AIParseResult,
  AuthResponse,
  Booking,
  BookingCreate,
  Catalog,
  ChatMessage,
  ChatResponse,
  Departure,
  FeaturedPackages,
  InventoryItem,
  InventoryItemIn,
  InventoryMove,
  InvitePreview,
  Notification,
  Package,
  PackageCard,
  PackageIn,
  Quote,
  QuoteRequest,
  Settings,
  SmsProviderStatus,
  StaffCustomer,
  StaffDashboard,
  Theme,
  ThemeIn,
  TravelerIn,
  Trip,
  User,
  VoiceContext,
  VoiceConversationResult,
  VoiceConversationState,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
export const MEDIA_BASE = API_BASE.replace(/\/api\/v1$/, "");

const TOKEN_KEY = "mw_tokens";

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

export function loadTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens | null) {
  if (typeof window === "undefined") return;
  try {
    if (tokens) window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 저장 실패는 무시 */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query) {
  if (!query) return path;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

let refreshInFlight: Promise<Tokens | null> | null = null;

async function refreshTokens(): Promise<Tokens | null> {
  // A page can load several protected resources together. Refresh once so that
  // competing responses cannot replace each other's tokens.
  if (refreshInFlight) return refreshInFlight;
  const current = loadTokens();
  if (!current?.refresh_token) return null;
  refreshInFlight = (async () => {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    // Signing out or signing into another account invalidates this response.
    if (loadTokens()?.refresh_token !== current.refresh_token) return null;
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        saveTokens(null);
        return null;
      }
      throw new ApiError(res.status, "로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요");
    }
    const data = (await res.json()) as Tokens;
    if (loadTokens()?.refresh_token !== current.refresh_token) return null;
    saveTokens(data);
    return data;
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { query?: Query; retry?: boolean; form?: FormData } = {},
): Promise<T> {
  const tokens = loadTokens();
  const headers: Record<string, string> = {};
  if (!opts.form) headers["Content-Type"] = "application/json";
  if (tokens?.access_token) headers.Authorization = `Bearer ${tokens.access_token}`;

  const res = await fetch(`${API_BASE}${withQuery(path, opts.query)}`, {
    method,
    headers,
    body: opts.form ? opts.form : body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (res.status === 401 && tokens && opts.retry !== false) {
    const refreshed = await refreshTokens();
    if (refreshed) return request<T>(method, path, body, { ...opts, retry: false });
  }

  if (!res.ok) {
    let detail = `요청에 실패했어요 (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") detail = data.detail;
      else if (Array.isArray(data?.detail)) detail = data.detail.map((d: { msg: string }) => d.msg).join(", ");
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(path: string, query?: Query) => request<T>("GET", path, undefined, { query });
const post = <T>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, body, { query });
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

export const api = {
  // ── 인증 · 내 정보
  auth: {
    signup: (b: { email: string; password: string; name: string; phone: string; address: string }) =>
      post<AuthResponse>("/auth/signup", b),
    login: (b: { email: string; password: string }) => post<AuthResponse>("/auth/login", b),
  },
  me: {
    get: () => get<User>("/me"),
    update: (b: Partial<Pick<User, "name" | "phone" | "address">>) => put<User>("/me", b),
    trips: () => get<Trip[]>("/me/trips"),
    bookings: (status?: string) => get<Booking[]>("/me/bookings", { status }),
  },

  // ── 카탈로그
  catalog: () => get<Catalog>("/catalog"),
  themes: {
    list: () => get<Theme[]>("/themes"),
    get: (slug: string) => get<Theme>(`/themes/${slug}`),
  },
  packages: {
    list: (q?: {
      theme?: string;
      style?: string;
      region?: string;
      depart_from?: string;
      depart_to?: string;
      travelers?: number;
      min_price?: number;
      max_price?: number;
      sort?: "recommended" | "price_asc" | "price_desc" | "departure_soon";
      q?: string;
    }) => get<PackageCard[]>("/packages", q),
    featured: () => get<FeaturedPackages>("/packages/featured"),
    get: (id: number | string) => get<Package>(`/packages/${id}`),
    departures: (id: number | string) => get<Departure[]>(`/packages/${id}/departures`),
  },

  // ── 예약
  bookings: {
    quote: (b: QuoteRequest) => post<Quote>("/bookings/quote", b),
    create: (b: BookingCreate) => post<Booking>("/bookings", b),
    get: (id: number | string) => get<Booking>(`/bookings/${id}`),
    pay: (id: number | string, method: "card" | "transfer") => post<Booking>(`/bookings/${id}/pay`, { method }),
    addTraveler: (id: number | string, t: TravelerIn) => post<Booking>(`/bookings/${id}/travelers`, t),
    removeTraveler: (id: number | string, tid: number) => del<Booking>(`/bookings/${id}/travelers/${tid}`),
    join: (invite_code: string) => post<Booking>("/bookings/join", { invite_code }),
    invitePreview: (code: string) => get<InvitePreview>(`/bookings/invite/${code}`),
    cancel: (id: number | string) => post<Booking>(`/bookings/${id}/cancel`),
  },

  // ── AI (선택 기능)
  ai: {
    parse: (text: string, context: VoiceContext = "home") => post<AIParseResult>("/ai/parse", { text, context }),
    chat: (messages: ChatMessage[]) => post<ChatResponse>("/ai/chat", { messages }),
    conversation: (text: string, state: VoiceConversationState | null = null) => post<VoiceConversationResult>("/ai/conversation", { text, state }),
  },

  // ── 직원
  staff: {
    dashboard: () => get<StaffDashboard>("/staff/dashboard"),
    themes: {
      list: () => get<Theme[]>("/staff/themes"),
      create: (b: ThemeIn) => post<Theme>("/staff/themes", b),
      update: (id: number, b: ThemeIn) => put<Theme>(`/staff/themes/${id}`, b),
      remove: (id: number) => del<void>(`/staff/themes/${id}`),
      reorder: (ids: number[]) => put<Theme[]>("/staff/themes/reorder", { ids }),
    },
    packages: {
      list: (q?: { theme?: string; published?: boolean; q?: string }) => get<Package[]>("/staff/packages", q),
      get: (id: number | string) => get<Package>(`/staff/packages/${id}`),
      create: (b: PackageIn) => post<Package>("/staff/packages", b),
      update: (id: number | string, b: PackageIn) => put<Package>(`/staff/packages/${id}`, b),
      remove: (id: number | string) => del<void>(`/staff/packages/${id}`),
      publish: (id: number | string, is_published: boolean) =>
        post<Package>(`/staff/packages/${id}/publish`, { is_published }),
      addDeparture: (id: number | string, b: Omit<Departure, "id" | "package_id" | "booked" | "remaining">) =>
        post<Departure>(`/staff/packages/${id}/departures`, b),
      updateDeparture: (
        id: number | string,
        did: number,
        b: Omit<Departure, "id" | "package_id" | "booked" | "remaining">,
      ) => put<Departure>(`/staff/packages/${id}/departures/${did}`, b),
      removeDeparture: (id: number | string, did: number) => del<void>(`/staff/packages/${id}/departures/${did}`),
    },
    inventory: {
      items: () => get<InventoryItem[]>("/staff/inventory/items"),
      createItem: (b: InventoryItemIn) => post<InventoryItem>("/staff/inventory/items", b),
      updateItem: (id: number, b: InventoryItemIn) => put<InventoryItem>(`/staff/inventory/items/${id}`, b),
      move: (id: number, b: { type: "in" | "out" | "adjust"; qty: number; memo: string }) =>
        post<InventoryItem>(`/staff/inventory/items/${id}/moves`, b),
      moves: (item_id?: number) => get<InventoryMove[]>("/staff/inventory/moves", { item_id }),
    },
    bookings: {
      list: (q?: { status?: string; departure_id?: number; package_id?: number; q?: string }) =>
        get<Booking[]>("/staff/bookings", q),
      confirm: (id: number) => post<Booking>(`/staff/bookings/${id}/confirm`),
      cancel: (id: number) => post<Booking>(`/staff/bookings/${id}/cancel`),
      complete: (id: number) => post<Booking>(`/staff/bookings/${id}/complete`),
    },
    customers: {
      list: (q?: string) => get<StaffCustomer[]>("/staff/customers", { q }),
      get: (id: number) => get<{ user: User; bookings: Booking[] }>(`/staff/customers/${id}`),
    },
    notifications: (limit = 50) => get<Notification[]>("/staff/notifications", { limit }),
    sms: {
      provider: () => get<SmsProviderStatus>("/staff/notifications/provider"),
      test: (phone: string, body: string) => post<Notification>("/staff/notifications/test", { phone, body }),
      resend: (id: number) => post<Notification>(`/staff/notifications/${id}/resend`),
    },
    settings: {
      get: () => get<Settings>("/staff/settings"),
      update: (b: Partial<Settings>) => put<Settings>("/staff/settings", b),
    },
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ url: string }>("POST", "/staff/upload", undefined, { form });
    },
  },
};

/** 백엔드가 준 이미지 경로를 실제 URL로. (`/media/..` → 백엔드, `/images/..` → 프론트 public, http → 그대로) */
export function imageUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/media/")) return `${MEDIA_BASE}${src}`;
  return src;
}
