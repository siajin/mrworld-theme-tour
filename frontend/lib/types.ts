// docs/api-contract.md 와 1:1 대응. 백엔드 응답 형태를 바꾸면 여기와 계약 문서를 함께 수정한다.

export type Role = "customer" | "staff";
export type StyleCode = "classic" | "grand" | "premium";
export type MealCode = "lunchbox" | "local" | "fine_dining";
export type TransportCode = "sedan_2" | "van_10" | "limousine" | "premium_bus_25";
export type BookingStatus = "pending" | "gathering" | "confirmed" | "cancelled" | "completed";
export type DepartureStatus = "open" | "closed" | "departed";
export type LoyaltyTier = "basic" | "silver" | "gold";

export interface Loyalty {
  tier: LoyaltyTier;
  completed_trips: number;
  rate: number;
  next_tier_trips: number | null;
}

export interface User {
  id: number;
  email: string;
  role: Role;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  loyalty?: Loyalty;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: User;
}

export interface ThemePerk {
  id: number;
  label: string;
  inventory_item_id: number | null;
  qty_per_booking: number;
  per_person: boolean;
  unit: string;
}

export interface Theme {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  hero_image: string;
  min_style_rank: 1 | 2 | 3;
  min_travelers: number;
  vehicle_label: string;
  default_transport: TransportCode;
  sort_order: number;
  is_active: boolean;
  perks: ThemePerk[];
  package_count?: number;
  from_price?: number | null;
}

export interface ThemeIn {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  hero_image: string;
  min_style_rank: 1 | 2 | 3;
  min_travelers: number;
  vehicle_label: string;
  default_transport: TransportCode;
  is_active: boolean;
  perks: { label: string; inventory_item_id: number | null; qty_per_booking: number; per_person: boolean }[];
}

export interface Style {
  code: StyleCode;
  name: string;
  rank: number;
  hotel_grade: 3 | 4 | 5;
  meal_code: MealCode;
  description: string;
}

export interface Settings {
  min_travelers_default: number;
  loyalty_silver_trips: number;
  loyalty_silver_rate: number;
  loyalty_gold_trips: number;
  loyalty_gold_rate: number;
  deposit_rate: number;
}

export interface MealAddon {
  id: number;
  code: string;
  label: string;
  price: number;
  is_active: boolean;
}

export interface Catalog {
  styles: Style[];
  hotel_grades: { grade: 3 | 4 | 5; label: string; surcharge: number }[];
  meal_options: { code: MealCode; label: string; surcharge: number; description: string }[];
  transport_options: { code: TransportCode; label: string; capacity: number; surcharge: number }[];
  meal_addons: MealAddon[];
  settings: Settings;
}

export interface Departure {
  id: number;
  package_id: number;
  depart_date: string;
  return_date: string;
  capacity: number;
  booked: number;
  remaining: number;
  status: DepartureStatus;
}

export interface PackageCard {
  id: number;
  theme: { id: number; slug: string; name: string };
  title: string;
  subtitle: string;
  region: string;
  country: string;
  nights: number;
  days: number;
  hero_images: string[];
  from_price: number;
  from_style: StyleCode;
  badges: string[];
  next_departure: { id: number; depart_date: string; remaining: number } | null;
  rating: number;
  review_count: number;
  is_published: boolean;
}

export interface ItineraryDay {
  day_no: number;
  title: string;
  places: string[];
  meals: { breakfast: string; lunch: string; dinner: string };
  lodging: string;
  description: string;
}

export interface Package extends PackageCard {
  summary: string;
  includes: string[];
  excludes: string[];
  notes: string;
  highlights: string[];
  style_prices: { style_code: StyleCode; price: number; available: boolean }[];
  itinerary: ItineraryDay[];
  departures: Departure[];
  created_at: string;
  updated_at: string;
}

export interface PackageIn {
  theme_id: number;
  title: string;
  subtitle: string;
  region: string;
  country: string;
  nights: number;
  days: number;
  hero_images: string[];
  summary: string;
  highlights: string[];
  includes: string[];
  excludes: string[];
  notes: string;
  badges: string[];
  style_prices: { style_code: StyleCode; price: number }[];
  itinerary: ItineraryDay[];
  is_published: boolean;
  rating?: number;
  review_count?: number;
}

export interface FeaturedPackages {
  popular: PackageCard[];
  closing_soon: PackageCard[];
  by_theme: Record<string, PackageCard[]>;
}

export interface QuoteRequest {
  package_id: number;
  departure_id: number;
  style_code: StyleCode;
  hotel_grade?: 3 | 4 | 5;
  meal_code?: MealCode;
  transport_code?: TransportCode;
  addons?: { meal_addon_id: number; qty: number }[];
  travelers_count: number;
}

export interface Quote {
  per_person: number;
  style_price: number;
  hotel_delta: number;
  meal_delta: number;
  subtotal: number;
  transport_total: number;
  addons_total: number;
  discount: number;
  discount_rate: number;
  total: number;
  deposit: number;
  travelers_count: number;
  resolved: { hotel_grade: 3 | 4 | 5; meal_code: MealCode; transport_code: TransportCode };
  lines: { label: string; amount: number }[];
}

export interface TravelerIn {
  name: string;
  phone: string;
  birth?: string | null;
  is_representative?: boolean;
}

export interface Traveler extends TravelerIn {
  id: number;
  user_id: number | null;
  is_representative: boolean;
  joined_via_code: boolean;
}

export interface BookingCreate extends QuoteRequest {
  travelers: TravelerIn[];
  memo?: string;
}

export interface Booking {
  id: number;
  code: string;
  status: BookingStatus;
  customer: { id: number; name: string; phone: string; email: string };
  package: PackageCard;
  departure: Departure;
  theme: { slug: string; name: string; min_travelers: number; perks: ThemePerk[] };
  style_code: StyleCode;
  hotel_grade: 3 | 4 | 5;
  meal_code: MealCode;
  transport_code: TransportCode;
  addons: { meal_addon_id: number; label: string; qty: number; unit_price: number }[];
  travelers_count: number;
  travelers: Traveler[];
  quote: Quote;
  invite_code: string | null;
  needed_more: number;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  memo: string;
}

export interface InvitePreview {
  booking_id: number;
  package_title: string;
  theme_name: string;
  depart_date: string;
  representative_name: string;
  travelers_count: number;
  min_travelers: number;
  needed_more: number;
}

export interface Trip {
  booking_id: number;
  code: string;
  package_title: string;
  theme_name: string;
  region: string;
  depart_date: string;
  return_date: string;
  nights: number;
  days: number;
  style_code: StyleCode;
  style_name: string;
  total: number;
  status: BookingStatus;
  hero_image: string;
}

export interface Notification {
  id: number;
  user_id: number;
  user_name: string;
  channel: "sms";
  template: string;
  title: string;
  body: string;
  status: "queued" | "sent" | "failed";
  created_at: string;
  sent_at: string | null;
  provider: string | null;
  to: string | null;
  error: string | null;
}

export interface SmsProviderStatus {
  provider: "console" | "solapi";
  requested: string;
  configured: boolean;
  sender: string | null;
  live: boolean;
}

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock_qty: number;
  reorder_level: number;
  is_active: boolean;
  low_stock: boolean;
}

export interface InventoryItemIn {
  sku: string;
  name: string;
  category: string;
  unit: string;
  stock_qty?: number;
  reorder_level: number;
  is_active: boolean;
}

export interface InventoryMove {
  id: number;
  item_id: number;
  item_name: string;
  type: "in" | "out" | "adjust";
  qty: number;
  ref_booking_id: number | null;
  memo: string;
  created_by_name: string;
  created_at: string;
}

export interface StaffDashboard {
  today_bookings: number;
  gathering_bookings: number;
  confirmed_this_week: number;
  revenue_this_month: number;
  upcoming_departures: { departure: Departure; package_title: string; theme_name: string; bookings: number }[];
  low_stock_items: InventoryItem[];
  recent_notifications: Notification[];
  recent_bookings: Booking[];
}

export interface StaffCustomer extends User {
  bookings_count: number;
  last_trip: string | null;
}

export type VoiceContext = "home" | "search" | "theme" | "package" | "booking" | "me" | "other";
export type Intent =
  | "search"
  | "select_result"
  | "set_style"
  | "set_travelers"
  | "set_departure"
  | "set_hotel"
  | "set_meal"
  | "book"
  | "go_back"
  | "go_home"
  | "my_bookings"
  | "help"
  | "unknown";

export interface IntentSlots {
  index: number | null; // select_result: 1부터, -1 = 마지막
  depart_date: string | null;
  departure_pick: "earliest" | "next" | "last" | null;
  hotel_grade: number | null;
  meal_code: MealCode | null;
}

export interface AIParseResult {
  theme_slug: string | null;
  region: string | null;
  depart_from: string | null;
  depart_to: string | null;
  travelers_count: number | null;
  style_code: StyleCode | null;
  budget_max: number | null;
  keywords: string[];
  summary: string;
  matched_package_ids: number[];
  intent: Intent;
  slots: IntentSlots;
  reply: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  packages: PackageCard[];
}
