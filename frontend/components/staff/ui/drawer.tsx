"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect } from "react";

/** 우측 슬라이드 드로어 (예약 상세 등) */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "w-full sm:w-[560px]",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <button
        aria-label="닫기"
        className="absolute inset-0 bg-ink/35"
        onClick={onClose}
      />
      <aside
        className={clsx(
          "absolute inset-y-0 right-0 flex max-w-full flex-col bg-surface shadow-[var(--shadow-float)]",
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-bold text-ink">{title}</h2>
            {subtitle && (
              <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="border-t border-line px-6 py-3">{footer}</footer>
        )}
      </aside>
    </div>
  );
}
