"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { SlidersHorizontal, X } from "lucide-react";
import type { PackageCard, StyleCode, Theme } from "@/lib/types";
import { STYLE_LABEL } from "@/lib/format";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { shortThemeName } from "./theme-icon";
import { isStyleCode, monthOptions } from "./utils";

export type SortKey = "recommended" | "price_asc" | "price_desc" | "departure_soon";

export interface PackageFilters {
  theme: string;
  style: StyleCode | "";
  /** short(2박 이하) / mid(3~4박) / long(5박 이상) */
  duration: "" | "short" | "mid" | "long";
  price: "" | "u100" | "100-200" | "o200";
  month: string;
  sort: SortKey;
  region: string;
  q: string;
  travelers: number | null;
  depart_from: string;
  depart_to: string;
  max_price: number | null;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "추천순" },
  { value: "price_asc", label: "가격 낮은순" },
  { value: "price_desc", label: "가격 높은순" },
  { value: "departure_soon", label: "출발 임박순" },
];

const DURATION_OPTIONS = [
  { value: "", label: "기간 전체" },
  { value: "short", label: "2박 이하" },
  { value: "mid", label: "3~4박" },
  { value: "long", label: "5박 이상" },
] as const;

const PRICE_OPTIONS = [
  { value: "", label: "가격대 전체" },
  { value: "u100", label: "100만원 이하" },
  { value: "100-200", label: "100~200만원" },
  { value: "o200", label: "200만원 이상" },
] as const;

export function readFilters(sp: URLSearchParams): PackageFilters {
  const style = sp.get("style");
  const duration = sp.get("duration");
  const price = sp.get("price");
  const sort = sp.get("sort");
  const travelers = Number(sp.get("travelers"));
  const maxPrice = Number(sp.get("max_price"));
  return {
    theme: sp.get("theme") ?? "",
    style: isStyleCode(style) ? style : "",
    duration: duration === "short" || duration === "mid" || duration === "long" ? duration : "",
    price: price === "u100" || price === "100-200" || price === "o200" ? price : "",
    month: sp.get("month") ?? "",
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? (sort as SortKey) : "recommended",
    region: sp.get("region") ?? "",
    q: sp.get("q") ?? "",
    travelers: travelers > 0 ? travelers : null,
    depart_from: sp.get("depart_from") ?? "",
    depart_to: sp.get("depart_to") ?? "",
    max_price: maxPrice > 0 ? maxPrice : null,
  };
}

/** 필터 → API 파라미터 (기간·검색어는 클라이언트에서 후처리) */
export function toApiQuery(f: PackageFilters) {
  const months = monthOptions(12);
  const m = months.find((x) => x.value === f.month);
  let min_price: number | undefined;
  let max_price: number | undefined = f.max_price ?? undefined;
  if (f.price === "u100") max_price = 1_000_000;
  if (f.price === "100-200") {
    min_price = 1_000_000;
    max_price = 2_000_000;
  }
  if (f.price === "o200") min_price = 2_000_000;
  return {
    theme: f.theme || undefined,
    style: f.style || undefined,
    region: f.region || undefined,
    depart_from: m?.from ?? (f.depart_from || undefined),
    depart_to: m?.to ?? (f.depart_to || undefined),
    travelers: f.travelers ?? undefined,
    min_price,
    max_price,
    sort: f.sort,
  };
}

/** 기간 + 검색어(공백 분리 토큰 모두 포함) 클라이언트 필터 */
export function applyClientFilters(list: PackageCard[], f: PackageFilters) {
  let out = list;
  if (f.duration === "short") out = out.filter((p) => p.nights <= 2);
  if (f.duration === "mid") out = out.filter((p) => p.nights >= 3 && p.nights <= 4);
  if (f.duration === "long") out = out.filter((p) => p.nights >= 5);
  const tokens = f.q.trim().split(/\s+/).filter(Boolean);
  if (tokens.length) {
    out = out.filter((p) => {
      const hay = `${p.title} ${p.subtitle} ${p.region} ${p.country} ${p.theme.name}`;
      return tokens.every((t) => hay.includes(t));
    });
  }
  return out;
}

/** URL 쿼리를 단일 진실 원천으로 쓰는 필터 훅 */
export function usePackageFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => readFilters(new URLSearchParams(sp.toString())), [sp]);

  const update = useCallback(
    (patch: Partial<PackageFilters>) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(patch).forEach(([k, v]) => {
        if (v === "" || v === null || v === undefined || v === "recommended") next.delete(k);
        else next.set(k, String(v));
      });
      // summary/said 는 최초 진입용 — 필터를 바꾸면 지운다
      if (Object.keys(patch).some((k) => k !== "sort")) {
        next.delete("summary");
        next.delete("said");
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  return { filters, update, reset };
}

/**
 * sticky 필터 바. themes 를 넘기면 테마 칩도 보여 준다(검색 페이지).
 * fixedTheme 이 있으면 테마 칩 대신 해당 테마 규칙(클래식 비활성)을 적용한다(테마 페이지).
 */
export function PackageFilterBar({
  filters,
  onChange,
  onReset,
  themes,
  fixedTheme,
  total,
  className,
}: {
  filters: PackageFilters;
  onChange: (patch: Partial<PackageFilters>) => void;
  onReset: () => void;
  themes?: Theme[];
  fixedTheme?: Theme | null;
  total?: number | null;
  className?: string;
}) {
  const months = monthOptions(6);
  const activeTheme = fixedTheme ?? themes?.find((t) => t.slug === filters.theme) ?? null;
  const classicDisabled = (activeTheme?.min_style_rank ?? 1) > 1;
  const activeCount = [filters.style, filters.duration, filters.price, filters.month, filters.region, filters.q].filter(
    Boolean,
  ).length + (themes && filters.theme ? 1 : 0);

  return (
    <div className={clsx("sticky top-[56px] z-30 border-b border-line bg-surface/95 backdrop-blur md:top-[64px]", className)}>
      <div className="mx-auto max-w-[1120px] px-4 py-3">
        {themes && (
          <ChipRow className="mb-3">
            <Chip size="sm" selected={!filters.theme} onClick={() => onChange({ theme: "" })} aria-label="전체 테마">
              전체
            </Chip>
            {themes.map((t) => (
              <Chip
                key={t.slug}
                size="sm"
                selected={filters.theme === t.slug}
                onClick={() => onChange({ theme: t.slug, style: t.min_style_rank > 1 && filters.style === "classic" ? "" : filters.style })}
              >
                {shortThemeName(t.name)}
              </Chip>
            ))}
          </ChipRow>
        )}

        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          <SlidersHorizontal className="hidden size-4 shrink-0 text-muted md:block" aria-hidden />
          <Segmented<StyleCode | "">
            value={filters.style}
            onChange={(v) => onChange({ style: v })}
            items={[
              { value: "", label: "전체" },
              { value: "classic", label: STYLE_LABEL.classic, disabled: classicDisabled },
              { value: "grand", label: STYLE_LABEL.grand },
              { value: "premium", label: STYLE_LABEL.premium },
            ]}
            className="shrink-0"
          />
          <div className="w-[122px] shrink-0">
            <Select
              aria-label="기간"
              value={filters.duration}
              onChange={(e) => onChange({ duration: e.target.value as PackageFilters["duration"] })}
              className="h-11 text-[14px]"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[146px] shrink-0">
            <Select
              aria-label="가격대"
              value={filters.price}
              onChange={(e) => onChange({ price: e.target.value as PackageFilters["price"], max_price: null })}
              className="h-11 text-[14px]"
            >
              {PRICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[142px] shrink-0">
            <Select
              aria-label="출발월"
              value={filters.month}
              onChange={(e) => onChange({ month: e.target.value, depart_from: "", depart_to: "" })}
              className="h-11 text-[14px]"
            >
              <option value="">출발월 전체</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[132px] shrink-0 md:ml-auto">
            <Select
              aria-label="정렬"
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="h-11 text-[14px]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              aria-label="필터 초기화"
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-[var(--radius-btn)] px-3 text-[13px] font-semibold text-muted hover:bg-bg hover:text-ink"
            >
              <X className="size-4" aria-hidden /> 초기화
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
          {total != null && (
            <span>
              총 <b className="tabular text-ink">{total}</b>개 상품
            </span>
          )}
          {filters.region && (
            <span>
              지역 <b className="text-ink">{filters.region}</b>
              <button type="button" onClick={() => onChange({ region: "" })} aria-label="지역 필터 해제" className="ml-1 text-muted-2 hover:text-ink">
                ×
              </button>
            </span>
          )}
          {filters.q && (
            <span>
              검색어 <b className="text-ink">“{filters.q}”</b>
              <button type="button" onClick={() => onChange({ q: "" })} aria-label="검색어 해제" className="ml-1 text-muted-2 hover:text-ink">
                ×
              </button>
            </span>
          )}
          {filters.travelers && <span>{filters.travelers}명 기준</span>}
          {(filters.depart_from || filters.depart_to) && !filters.month && (
            <span className="tabular">
              출발 {filters.depart_from || "…"} ~ {filters.depart_to || "…"}
              <button type="button" onClick={() => onChange({ depart_from: "", depart_to: "" })} aria-label="출발일 필터 해제" className="ml-1 text-muted-2 hover:text-ink">
                ×
              </button>
            </span>
          )}
          {classicDisabled && (
            <span className="text-muted-2">이 테마는 그랜드 스타일 이상만 선택할 수 있어요</span>
          )}
        </div>
      </div>
    </div>
  );
}
