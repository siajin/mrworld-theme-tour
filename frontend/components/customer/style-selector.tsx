"use client";

import { clsx } from "clsx";
import { BedDouble, Check, UtensilsCrossed } from "lucide-react";
import type { Catalog, Package, StyleCode } from "@/lib/types";
import { HOTEL_LABEL, MEAL_LABEL, STYLE_LABEL, won } from "@/lib/format";
import { STYLE_CODES } from "./utils";

/** 스타일 3장 카드. 선택 불가(테마 최소 스타일 미만)는 비활성 + 사유 표시. */
export function StyleSelector({
  pkg,
  catalog,
  value,
  onChange,
  themeName,
  className,
}: {
  pkg: Package;
  catalog: Catalog;
  value: StyleCode;
  onChange: (s: StyleCode) => void;
  themeName?: string;
  className?: string;
}) {
  const current = pkg.style_prices.find((s) => s.style_code === value)?.price ?? 0;
  // 테마가 허용하는 가장 낮은 스타일 (style_prices.available = rank >= theme.min_style_rank)
  const minAvailable = STYLE_CODES.find((c) => pkg.style_prices.some((s) => s.style_code === c && s.available)) ?? "grand";

  return (
    <div className={clsx("grid gap-3 md:grid-cols-3", className)} role="radiogroup" aria-label="스타일 선택">
      {STYLE_CODES.map((code) => {
        const sp = pkg.style_prices.find((s) => s.style_code === code);
        const meta = catalog.styles.find((s) => s.code === code);
        const available = !!sp?.available;
        const active = code === value;
        const diff = sp ? sp.price - current : 0;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!available}
            onClick={() => available && onChange(code)}
            aria-label={`${STYLE_LABEL[code]} 스타일${sp ? `, 1인 ${won(sp.price)}` : ""}`}
            className={clsx(
              "relative flex flex-col rounded-[var(--radius-card)] border p-4 text-left transition-colors",
              active
                ? "border-primary bg-primary-soft/60 ring-1 ring-primary"
                : available
                  ? "border-line bg-surface hover:border-ink-2"
                  : "cursor-not-allowed border-line bg-bg",
            )}
          >
            <div className="flex items-center justify-between">
              <span className={clsx("text-[16px] font-bold", available ? "text-ink" : "text-muted-2")}>{STYLE_LABEL[code]}</span>
              {active && (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="size-3.5" aria-hidden />
                </span>
              )}
              {code === "grand" && !active && available && (
                <span className="rounded-md bg-bg px-1.5 py-0.5 text-[11px] font-semibold text-muted">가장 많이 선택</span>
              )}
            </div>
            <ul className={clsx("mt-2.5 space-y-1 text-[13px]", available ? "text-ink-2" : "text-muted-2")}>
              <li className="flex items-center gap-1.5">
                <BedDouble className="size-3.5 shrink-0" aria-hidden />
                {HOTEL_LABEL(meta?.hotel_grade ?? 4)}
              </li>
              <li className="flex items-center gap-1.5">
                <UtensilsCrossed className="size-3.5 shrink-0" aria-hidden />
                {MEAL_LABEL[meta?.meal_code ?? "local"]}
              </li>
            </ul>
            <div className="mt-3 flex items-end justify-between">
              {available && sp ? (
                <>
                  <span className="text-[12px] text-muted">성인 1인</span>
                  <span className="text-right">
                    <span className="block text-[17px] font-bold tabular text-ink">{won(sp.price)}</span>
                    {!active && diff !== 0 && (
                      <span className={clsx("text-[12px] tabular", diff > 0 ? "text-accent" : "text-success")}>
                        {diff > 0 ? "+" : "−"}
                        {won(Math.abs(diff))}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-[12px] leading-snug text-muted-2">
                  {themeName ? `${themeName.replace(/ 투어$/, "")} 테마는 ` : "이 테마는 "}
                  {STYLE_LABEL[minAvailable]} 스타일 이상만 선택할 수 있어요
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
