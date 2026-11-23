"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { BedDouble, MapPin } from "lucide-react";
import type { ItineraryDay } from "@/lib/types";

/** 일정표: 일차 탭 → 제목 · 방문지 칩 · 식사(조/중/석) · 숙소 · 설명 */
export function Itinerary({ days, className }: { days: ItineraryDay[]; className?: string }) {
  const [day, setDay] = useState(days[0]?.day_no ?? 1);
  const cur = days.find((d) => d.day_no === day) ?? days[0];

  if (!cur) return <p className="text-[14px] text-muted">일정표가 준비 중이에요.</p>;

  const meals: { k: keyof ItineraryDay["meals"]; label: string }[] = [
    { k: "breakfast", label: "조식" },
    { k: "lunch", label: "중식" },
    { k: "dinner", label: "석식" },
  ];

  return (
    <div className={className}>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="일차 선택">
        {days.map((d) => (
          <button
            key={d.day_no}
            type="button"
            role="tab"
            aria-selected={d.day_no === day}
            onClick={() => setDay(d.day_no)}
            className={clsx(
              "h-10 shrink-0 rounded-full border px-4 text-[14px] font-semibold tabular transition-colors",
              d.day_no === day ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink-2",
            )}
          >
            {d.day_no}일차
          </button>
        ))}
      </div>

      <article className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5" role="tabpanel">
        <p className="text-[12px] font-bold tracking-wide text-primary">DAY {cur.day_no}</p>
        <h4 className="mt-1 text-[18px] font-bold text-ink">{cur.title}</h4>

        {cur.places.length > 0 && (
          <ol className="mt-3 flex flex-wrap items-center gap-y-2 text-[13.5px]" aria-label="방문지">
            {cur.places.map((p, i) => (
              <li key={`${p}-${i}`} className="flex items-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-ink-2">
                  {i === 0 && <MapPin className="size-3.5 text-primary" aria-hidden />}
                  {p}
                </span>
                {i < cur.places.length - 1 && <span className="mx-1.5 text-muted-2" aria-hidden>›</span>}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <dl className="grid grid-cols-3 gap-2 rounded-[var(--radius-input)] bg-bg p-3 text-[13px]">
            {meals.map((m) => (
              <div key={m.k}>
                <dt className="text-[12px] font-semibold text-muted">{m.label}</dt>
                <dd className="mt-0.5 text-ink-2">{cur.meals[m.k] || "-"}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center gap-2 rounded-[var(--radius-input)] bg-bg px-3 py-3 text-[13px] sm:min-w-[180px]">
            <BedDouble className="size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="text-[12px] font-semibold text-muted">숙소</p>
              <p className="text-ink-2">{cur.lodging || "-"}</p>
            </div>
          </div>
        </div>

        {cur.description && <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">{cur.description}</p>}
      </article>
    </div>
  );
}
