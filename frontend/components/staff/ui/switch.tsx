"use client";

import { clsx } from "clsx";

/** 노출/활성 토글 스위치 */
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  size = "md",
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "size-4" : "size-5";
  const shift = size === "sm" ? "translate-x-4" : "translate-x-5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        track,
        checked ? "bg-primary" : "bg-line-strong",
        className,
      )}
    >
      <span
        className={clsx(
          "block rounded-full bg-white shadow-sm transition-transform",
          knob,
          checked ? shift : "translate-x-0",
        )}
      />
    </button>
  );
}
