"use client";

import { clsx } from "clsx";
import type { Departure } from "@/lib/types";
import { shortDate } from "@/lib/format";

/** 출발일 선택 칩 (가로 스크롤). 잔여 인원과 확정 여부를 함께 표시한다. */
export function DepartureChips({
  departures,
  value,
  onChange,
  minTravelers,
  className,
}: {
  departures: Departure[];
  value: number | null;
  onChange: (id: number) => void;
  minTravelers: number;
  className?: string;
}) {
  if (departures.length === 0) {
    return (
      <p className={clsx("rounded-[var(--radius-input)] bg-bg px-4 py-3 text-[14px] text-muted", className)}>
        현재 예약 가능한 출발일이 없어요. 고객센터로 문의해 주세요.
      </p>
    );
  }
  return (
    <div className={clsx("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0", className)} role="radiogroup" aria-label="출발일 선택">
      {departures.map((d) => {
        const active = d.id === value;
        const soldOut = d.remaining <= 0;
        const confirmed = d.booked >= minTravelers;
        const few = d.remaining > 0 && d.remaining <= 3;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={soldOut}
            onClick={() => onChange(d.id)}
            aria-label={`${shortDate(d.depart_date)} 출발, 잔여 ${d.remaining}명`}
            className={clsx(
              "flex min-w-[112px] shrink-0 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors",
              active
                ? "border-primary bg-primary-soft"
                : soldOut
                  ? "cursor-not-allowed border-line bg-bg text-muted-2"
                  : "border-line bg-surface hover:border-ink-2",
            )}
          >
            <span className={clsx("text-[15px] font-bold tabular", active ? "text-primary" : soldOut ? "text-muted-2" : "text-ink")}>
              {shortDate(d.depart_date)}
            </span>
            <span className="mt-0.5 text-[12px] tabular text-muted">~{shortDate(d.return_date)}</span>
            <span
              className={clsx(
                "mt-1.5 text-[12px] font-semibold",
                soldOut ? "text-muted-2" : confirmed ? "text-success" : few ? "text-accent" : "text-muted",
              )}
            >
              {soldOut ? "마감" : confirmed ? `출발 확정 · 잔여 ${d.remaining}` : `잔여 ${d.remaining}명`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
