"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useState } from "react";

/** 태그(칩) 입력. Enter/쉼표로 추가, Backspace로 마지막 삭제. */
export function TagInput({
  value,
  onChange,
  placeholder = "입력 후 Enter",
  className,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const t = draft.trim().replace(/,$/, "").trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };

  return (
    <div
      className={clsx(
        "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-input)] border border-line-strong bg-surface px-2.5 py-1.5 focus-within:border-primary",
        disabled && "bg-bg",
        className,
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary-soft pl-2.5 pr-1 text-[13px] font-medium text-primary"
        >
          {t}
          {!disabled && (
            <button
              type="button"
              aria-label={`${t} 삭제`}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="inline-flex size-5 items-center justify-center rounded hover:bg-white/60"
            >
              <X className="size-3.5" />
            </button>
          )}
        </span>
      ))}
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="h-7 min-w-[120px] flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-2"
      />
    </div>
  );
}
