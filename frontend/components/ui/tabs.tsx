"use client";

import { clsx } from "clsx";

export interface TabItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

/** 밑줄형 탭 (상세 페이지 섹션 탭, 마이페이지 등) */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  sticky = false,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        "no-scrollbar flex overflow-x-auto border-b border-line bg-surface",
        sticky && "sticky top-[56px] md:top-[64px] z-30",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={clsx(
              "relative shrink-0 px-4 h-12 text-[15px] font-semibold transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink-2",
            )}
          >
            {it.label}
            {it.count != null && <span className="ml-1 text-[12px] text-muted-2">{it.count}</span>}
            {active && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-ink" />}
          </button>
        );
      })}
    </div>
  );
}

/** 세그먼트형 탭 (스타일 선택 등 작은 토글) */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={clsx("inline-flex rounded-[10px] bg-bg p-1 border border-line", className)}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          disabled={it.disabled}
          onClick={() => onChange(it.value)}
          className={clsx(
            "h-9 px-3.5 rounded-[8px] text-[14px] font-semibold transition-colors",
            it.value === value ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink-2",
            it.disabled && "opacity-40 cursor-not-allowed",
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
