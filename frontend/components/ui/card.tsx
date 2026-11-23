import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

/** 흰 카드. 그림자는 한 단계만. */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("bg-surface rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-card)]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-primary mb-1">{eyebrow}</p>
        )}
        <h2 className="text-[20px] md:text-[24px] font-bold text-ink leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
