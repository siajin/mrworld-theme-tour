"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { imageUrl } from "@/lib/api";

/** 이미지 로드 실패 시 그라데이션으로 대체되는 사진 */
export function Photo({
  src,
  alt,
  className,
  imgClassName,
  sizes,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(src);
  return (
    <div className={clsx("relative overflow-hidden img-fallback", className)}>
      {url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          sizes={sizes}
          loading="lazy"
          onError={() => setFailed(true)}
          className={clsx("absolute inset-0 size-full object-cover", imgClassName)}
        />
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-line", className)} />;
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={clsx("border-b border-line", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left text-[15px] font-semibold text-ink"
      >
        <span>{title}</span>
        <ChevronDown className={clsx("size-5 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="pb-4 text-[14px] text-ink-2 leading-relaxed">{children}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={clsx("border-line", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-[14px] text-muted max-w-[320px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** 단계 표시 (예약 4단계) */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={clsx(
                "size-6 inline-flex items-center justify-center rounded-full text-[12px] font-bold",
                state === "active" && "bg-primary text-white",
                state === "done" && "bg-primary-soft text-primary",
                state === "todo" && "bg-bg text-muted-2 border border-line",
              )}
            >
              {i + 1}
            </span>
            <span
              className={clsx(
                "text-[13px] font-semibold",
                state === "active" ? "text-ink" : "text-muted-2",
                "hidden sm:inline",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && <span className="w-6 h-px bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}
