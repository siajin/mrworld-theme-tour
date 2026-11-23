"use client";

import { clsx } from "clsx";
import { Minus, Plus } from "lucide-react";

/** 인원·수량 스테퍼 ( − n + ) */
export function CountStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  unit = "명",
  size = "md",
  label = "인원",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const btn = clsx(
    "inline-flex items-center justify-center rounded-full border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:text-muted-2 disabled:hover:bg-surface",
    size === "sm" ? "size-7" : "size-9",
  );
  return (
    <div className={clsx("inline-flex items-center", size === "sm" ? "gap-2" : "gap-3", className)} role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`${label} 줄이기`}
      >
        <Minus className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      </button>
      <span
        className={clsx("min-w-[2.5em] text-center font-bold tabular text-ink", size === "sm" ? "text-[14px]" : "text-[16px]")}
        aria-live="polite"
      >
        {value}
        {unit}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label} 늘리기`}
      >
        <Plus className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      </button>
    </div>
  );
}
