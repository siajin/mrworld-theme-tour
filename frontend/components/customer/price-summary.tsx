import { clsx } from "clsx";
import type { Quote } from "@/lib/types";
import { won } from "@/lib/format";
import { Skeleton } from "@/components/ui/misc";

/** 견적 라인 + 합계 + 예약금. quote 가 없으면 스켈레톤. */
export function PriceSummary({
  quote,
  loading = false,
  compact = false,
  className,
}: {
  quote: Quote | null;
  loading?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (!quote) {
    return (
      <div className={clsx("space-y-2.5", className)} aria-busy="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    );
  }
  return (
    <div className={clsx("text-[14px]", loading && "opacity-60 transition-opacity", className)}>
      <dl className="space-y-1.5">
        {quote.lines.map((l, i) => (
          <div key={`${l.label}-${i}`} className="flex items-baseline justify-between gap-3">
            <dt className={clsx("min-w-0 flex-1", l.amount < 0 ? "text-primary" : "text-ink-2")}>{l.label}</dt>
            <dd className={clsx("shrink-0 tabular", l.amount < 0 ? "font-semibold text-primary" : "text-ink")}>
              {l.amount < 0 ? `−${won(Math.abs(l.amount))}` : won(l.amount)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="my-3 border-t border-line" />
      <div className="flex items-baseline justify-between">
        <span className={clsx("font-bold text-ink", compact ? "text-[15px]" : "text-[16px]")}>총 결제 예정 금액</span>
        <span className={clsx("font-bold tabular text-ink", compact ? "text-[18px]" : "text-[22px]")}>{won(quote.total)}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[13px]">
        <span className="text-muted">지금 결제할 예약금 (10%)</span>
        <span className="font-semibold tabular text-primary">{won(quote.deposit)}</span>
      </div>
      <p className="mt-1 text-[12px] text-muted-2">
        1인 {won(quote.per_person)} × {quote.travelers_count}명
        {quote.discount > 0 && ` · 단골 할인 ${Math.round(quote.discount_rate * 100)}% 적용`}
      </p>
    </div>
  );
}
