"use client";

import { clsx } from "clsx";
import { Info } from "lucide-react";
import type { Catalog, MealCode, Package, Theme, TransportCode } from "@/lib/types";
import { won } from "@/lib/format";
import { Segmented } from "@/components/ui/tabs";
import { Select } from "@/components/ui/field";
import { Accordion } from "@/components/ui/misc";
import { CountStepper } from "./count-stepper";
import {
  floorHotelMessage,
  floorMealMessage,
  hotelAllowed,
  mealAllowed,
  optionFloor,
  styleDefaults,
  type BookingOptions,
} from "./utils";

/**
 * "세부 변경" 아코디언: 호텔 등급 / 교통 / 식사 / 식사 추가옵션.
 * 차액은 카탈로그 기준으로 표시하고 실제 총액은 quote 가 확정한다.
 * 테마 최소 스타일 아래의 호텔·식사, 인원보다 정원이 작은 차량은 고를 수 없다 (백엔드 400 과 동일 규칙).
 */
export function OptionEditor({
  catalog,
  pkg,
  theme,
  nights,
  days,
  options,
  onChange,
  defaultOpen = false,
  className,
}: {
  catalog: Catalog;
  pkg: Package | null;
  theme: Theme | null;
  nights: number;
  days: number;
  options: BookingOptions;
  onChange: (patch: Partial<BookingOptions>) => void;
  defaultOpen?: boolean;
  className?: string;
}) {
  const base = styleDefaults(catalog, options.style);
  const baseHotel = catalog.hotel_grades.find((h) => h.grade === base.hotel)?.surcharge ?? 0;
  const baseMeal = catalog.meal_options.find((m) => m.code === base.meal)?.surcharge ?? 0;
  const themeVehicle = theme?.default_transport;
  const floor = optionFloor(catalog, pkg, theme);
  const hotelLocked = catalog.hotel_grades.some((h) => !hotelAllowed(h.grade, floor));
  const mealLocked = catalog.meal_options.some((m) => !mealAllowed(m.code, floor));
  const transportLocked = catalog.transport_options.some((t) => t.capacity < options.travelers);

  const deltaLabel = (n: number) => (n === 0 ? "기본" : `${n > 0 ? "+" : "−"}${won(Math.abs(n))}`);

  return (
    <div className={clsx("rounded-[var(--radius-card)] border border-line bg-surface px-5", className)}>
      <Accordion
        defaultOpen={defaultOpen}
        className="border-b-0"
        title={
          <span className="flex items-center gap-2">
            세부 변경
            <span className="text-[12px] font-medium text-muted">호텔 등급 · 교통 · 식사 · 추가옵션</span>
          </span>
        }
      >
        <div className="space-y-6">
          {/* 호텔 등급 */}
          <section>
            <div className="flex items-baseline justify-between">
              <h4 className="text-[14px] font-bold text-ink">호텔 등급</h4>
              <span className="text-[12px] text-muted">1인·1박 차액 × {nights}박</span>
            </div>
            <Segmented<"3" | "4" | "5">
              className="mt-2"
              value={String(options.hotel) as "3" | "4" | "5"}
              onChange={(v) => {
                const g = Number(v) as 3 | 4 | 5;
                if (hotelAllowed(g, floor)) onChange({ hotel: g });
              }}
              items={catalog.hotel_grades.map((h) => ({
                value: String(h.grade) as "3" | "4" | "5",
                label: `${h.label}${h.surcharge - baseHotel !== 0 ? ` ${deltaLabel((h.surcharge - baseHotel) * nights)}` : ""}`,
                disabled: !hotelAllowed(h.grade, floor),
              }))}
            />
            {hotelLocked && <RuleNote>{floorHotelMessage(theme, floor)}</RuleNote>}
          </section>

          {/* 교통 */}
          <section>
            <div className="flex items-baseline justify-between">
              <h4 className="text-[14px] font-bold text-ink">교통</h4>
              <span className="text-[12px] text-muted">예약 1건당</span>
            </div>
            <Select
              className="mt-2"
              aria-label="교통 선택"
              value={options.transport}
              onChange={(e) => onChange({ transport: e.target.value as TransportCode })}
            >
              {catalog.transport_options.map((t) => (
                <option key={t.code} value={t.code} disabled={t.capacity < options.travelers}>
                  {t.label} (최대 {t.capacity}명)
                  {t.code === themeVehicle ? " · 테마 기본" : t.surcharge > 0 ? ` · +${won(t.surcharge)}` : ""}
                  {t.capacity < options.travelers ? " · 인원 초과" : ""}
                </option>
              ))}
            </Select>
            {transportLocked && (
              <RuleNote>
                여행 인원 {options.travelers}명이 탈 수 있는 차량만 고를 수 있어요
                {themeVehicle && !catalog.transport_options.some((t) => t.code === themeVehicle && t.capacity >= options.travelers)
                  ? ` (테마 기본 ${catalog.transport_options.find((t) => t.code === themeVehicle)?.label}은 정원 초과)`
                  : ""}
              </RuleNote>
            )}
            {!transportLocked && options.transport !== themeVehicle && themeVehicle && (
              <p className="mt-1.5 text-[12px] text-muted">
                테마 기본 차량은 {catalog.transport_options.find((t) => t.code === themeVehicle)?.label} 입니다.
              </p>
            )}
          </section>

          {/* 식사 */}
          <section>
            <div className="flex items-baseline justify-between">
              <h4 className="text-[14px] font-bold text-ink">식사</h4>
              <span className="text-[12px] text-muted">1인·1일 차액 × {days}일</span>
            </div>
            <Segmented<MealCode>
              className="mt-2 flex-wrap"
              value={options.meal}
              onChange={(v) => {
                if (mealAllowed(v, floor)) onChange({ meal: v });
              }}
              items={catalog.meal_options.map((m) => ({
                value: m.code,
                label: `${m.label}${m.surcharge - baseMeal !== 0 ? ` ${deltaLabel((m.surcharge - baseMeal) * days)}` : ""}`,
                disabled: !mealAllowed(m.code, floor),
              }))}
            />
            {mealLocked ? (
              <RuleNote>{floorMealMessage(catalog, theme, floor)}</RuleNote>
            ) : (
              <p className="mt-1.5 text-[12px] text-muted">{catalog.meal_options.find((m) => m.code === options.meal)?.description}</p>
            )}
          </section>

          {/* 식사 추가옵션 */}
          <section>
            <div className="flex items-baseline justify-between">
              <h4 className="text-[14px] font-bold text-ink">식사 추가옵션</h4>
              <span className="text-[12px] text-muted">1인당 · 1회 기준</span>
            </div>
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius-input)] border border-line">
              {catalog.meal_addons
                .filter((a) => a.is_active)
                .map((a) => {
                  const qty = options.addons[a.id] ?? 0;
                  const checked = qty > 0;
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          className="size-[18px] accent-primary"
                          checked={checked}
                          onChange={(e) => onChange({ addons: { ...options.addons, [a.id]: e.target.checked ? 1 : 0 } })}
                          aria-label={`${a.label} 추가`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ink">{a.label}</span>
                          <span className="block text-[12px] tabular text-muted">{won(a.price)} / 1인</span>
                        </span>
                      </label>
                      {checked && (
                        <CountStepper
                          size="sm"
                          unit="회"
                          min={1}
                          max={5}
                          label={`${a.label} 수량`}
                          value={qty}
                          onChange={(v) => onChange({ addons: { ...options.addons, [a.id]: v } })}
                        />
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        </div>
      </Accordion>
    </div>
  );
}

/** 규칙 때문에 비활성된 선택지가 있을 때 이유를 보여 주는 안내 문구 */
function RuleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-muted" role="note">
      <Info className="mt-[1px] size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
