"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect } from "react";

/**
 * 모달 / 바텀시트. 모바일에서는 아래에서 올라오는 시트, 데스크톱에서는 중앙 모달.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  sheetOnMobile = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  sheetOnMobile?: boolean;
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

  const width = { sm: "md:max-w-[420px]", md: "md:max-w-[560px]", lg: "md:max-w-[760px]" }[size];

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button aria-label="닫기" className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div
        className={clsx(
          "absolute bg-surface shadow-[var(--shadow-float)] flex flex-col max-h-[92dvh]",
          sheetOnMobile
            ? "inset-x-0 bottom-0 rounded-t-[20px] md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-card)] md:w-[calc(100%-32px)]"
            : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] w-[calc(100%-32px)]",
          width,
        )}
      >
        {(title || true) && (
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
            <h3 className="text-[17px] font-bold text-ink">{title}</h3>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="size-9 -mr-2 inline-flex items-center justify-center rounded-full text-muted hover:bg-bg"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}
