"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, UserPlus } from "lucide-react";
import type { Booking } from "@/lib/types";
import { BOOKING_STATUS, HOTEL_LABEL, STYLE_LABEL, duration, fullDate, won } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/misc";

const CANCELLABLE = new Set(["pending", "gathering", "confirmed"]);

/** 마이페이지 예약 카드 */
export function BookingCard({ booking, onCancel, className }: { booking: Booking; onCancel?: (b: Booking) => void; className?: string }) {
  const st = BOOKING_STATUS[booking.status];
  const gathering = booking.status === "gathering";
  const detailHref = `/me/bookings/${booking.id}`;

  return (
    <article className={clsx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-[12.5px] md:px-5">
        <span className="tabular text-muted">
          예약번호 <b className="text-ink-2">{booking.code}</b>
        </span>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      <div className="flex gap-4 p-4 md:p-5">
        <Link href={`/packages/${booking.package.id}`} className="shrink-0" aria-label={`${booking.package.title} 상품 보기`}>
          <Photo src={booking.package.hero_images[0]} alt={booking.package.title} className="size-[88px] rounded-xl md:size-[104px]" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-muted">
            {booking.theme.name} · {booking.package.region}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[16px] font-bold leading-snug text-ink">{booking.package.title}</h3>
          <p className="mt-1.5 text-[13px] tabular text-ink-2">
            {fullDate(booking.departure.depart_date)} ~ {fullDate(booking.departure.return_date)} · {duration(booking.package.nights, booking.package.days)}
          </p>
          <p className="text-[13px] text-ink-2">
            {STYLE_LABEL[booking.style_code]} 스타일 · {HOTEL_LABEL(booking.hotel_grade)} ·{" "}
            <span className="tabular">
              {booking.travelers_count}명
              {gathering && <span className="text-muted"> / 최소 {booking.theme.min_travelers}명</span>}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[17px] font-bold tabular text-ink">{won(booking.quote.total)}</span>
            {gathering && booking.invite_code && (
              <span className="text-[12.5px] text-muted">
                초대 코드 <b className="tabular text-primary">{booking.invite_code}</b> · {booking.needed_more}명 더 필요
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 md:px-5">
        <Link
          href={detailHref}
          className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-btn)] bg-primary-soft px-3 text-[13px] font-semibold text-primary hover:bg-[#e3ecff]"
        >
          상세 <ChevronRight className="size-3.5" aria-hidden />
        </Link>
        {gathering && (
          <Link
            href={`${detailHref}#invite`}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-btn)] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-bg"
          >
            <UserPlus className="size-3.5" aria-hidden /> 동행 초대
          </Link>
        )}
        {onCancel && CANCELLABLE.has(booking.status) && (
          <Button variant="ghost" size="sm" className="ml-auto text-muted hover:text-danger" onClick={() => onCancel(booking)} aria-label={`${booking.code} 예약 취소`}>
            취소
          </Button>
        )}
      </div>
    </article>
  );
}

export function BookingCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex justify-between border-b border-line px-5 py-3">
        <div className="h-4 w-40 animate-pulse rounded bg-line" />
        <div className="h-5 w-16 animate-pulse rounded bg-line" />
      </div>
      <div className="flex gap-4 p-5">
        <div className="size-[104px] shrink-0 animate-pulse rounded-xl bg-line" />
        <div className="flex-1 space-y-2.5">
          <div className="h-3.5 w-1/3 animate-pulse rounded bg-line" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-line" />
          <div className="h-3.5 w-1/2 animate-pulse rounded bg-line" />
          <div className="h-5 w-1/4 animate-pulse rounded bg-line" />
        </div>
      </div>
    </div>
  );
}
