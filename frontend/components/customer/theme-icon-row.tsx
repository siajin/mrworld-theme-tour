"use client";

import { clsx } from "clsx";
import { LayoutGrid } from "lucide-react";
import type { Theme } from "@/lib/types";
import { ThemeIcon, shortThemeName } from "./theme-icon";

/**
 * 여기어때 상단 카테고리 아이콘 줄을 테마 4종으로 치환한 것.
 * 선택된 항목은 파란 테두리로 표시한다.
 */
export function ThemeIconRow({
  themes,
  value,
  onChange,
  includeAll = true,
  className,
}: {
  themes: Theme[];
  /** 선택된 테마 slug, "" 이면 전체 */
  value: string;
  onChange: (slug: string) => void;
  includeAll?: boolean;
  className?: string;
}) {
  const items: { slug: string; label: string; icon: React.ReactNode }[] = [
    ...(includeAll ? [{ slug: "", label: "전체", icon: <LayoutGrid className="size-6" aria-hidden /> }] : []),
    ...themes.map((t) => ({
      slug: t.slug,
      label: shortThemeName(t.name),
      icon: <ThemeIcon name={t.icon} className="size-6" aria-hidden />,
    })),
  ];

  return (
    <div role="radiogroup" aria-label="테마 선택" className={clsx("flex justify-center gap-3 sm:gap-6", className)}>
      {items.map((it) => {
        const active = it.slug === value;
        return (
          <button
            key={it.slug || "all"}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${it.label} 테마`}
            onClick={() => onChange(it.slug)}
            className="group flex w-[64px] flex-col items-center gap-1.5 sm:w-[80px]"
          >
            <span
              className={clsx(
                "inline-flex size-14 items-center justify-center rounded-2xl border-2 bg-surface transition-colors sm:size-16",
                active
                  ? "border-primary text-primary shadow-[var(--shadow-card)]"
                  : "border-line text-ink-2 group-hover:border-line-strong group-hover:text-ink",
              )}
            >
              {it.icon}
            </span>
            <span className={clsx("text-[13px] font-semibold", active ? "text-primary" : "text-ink-2")}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
