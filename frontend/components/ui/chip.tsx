import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  size?: "sm" | "md";
}

/** 여기어때 스타일 필터/탭 칩. selected 시 파란 배경. */
export function Chip({ selected = false, size = "md", className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors whitespace-nowrap",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-[14px]",
        selected
          ? "bg-primary border-primary text-white"
          : "bg-surface border-line-strong text-ink-2 hover:border-ink-2 disabled:text-muted-2 disabled:hover:border-line-strong disabled:cursor-not-allowed",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 가로 스크롤 칩 행 */
export function ChipRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx("no-scrollbar flex gap-2 overflow-x-auto py-1 -mx-4 px-4 md:mx-0 md:px-0", className)}>
      {children}
    </div>
  );
}
