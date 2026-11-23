"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Booking } from "@/lib/types";
import { BOOKING_STATUS, HOTEL_LABEL, STYLE_LABEL, TRANSPORT_LABEL, duration, fullDate, won } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { ThemeBenefits } from "./theme-benefits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo, Skeleton } from "@/components/ui/misc";
import { NotFoundBlock } from "./not-found-block";
import { AddTravelerForm, GatheringProgress, InviteCode } from "./invite-block";
import { loginHref } from "./utils";

export function BookingComplete({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(loginHref(`/booking/complete/${bookingId}`));
      return;
    }
    let alive = true;
    api.bookings
      .get(bookingId)
      .then((b) => alive && setBooking(b))
      .catch((err: unknown) => {
        if (!alive) return;
        if (!(err instanceof ApiError && (err.status === 404 || err.status === 403))) {
          toast(err instanceof Error ? err.message : "예약을 불러오지 못했어요", "error");
        }
        setBooking(null);
      });
    return () => {
      alive = false;
    };
  }, [bookingId, user, authLoading, router, toast]);

  if (booking === null) {
    return <NotFoundBlock title="예약을 찾을 수 없어요" description="본인 예약만 확인할 수 있어요." backHref="/me" backLabel="내 예약 보기" />;
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-10" aria-busy="true">
        <Skeleton className="mx-auto h-14 w-14 rounded-full" />
        <Skeleton className="mx-auto mt-5 h-7 w-56" />
        <Skeleton className="mt-8 h-[260px] w-full rounded-[var(--radius-card)]" />
      </div>
    );
  }

  const gathering = booking.status === "gathering";
  const confirmed = booking.status === "confirmed";
  const st = BOOKING_STATUS[booking.status];

  return (
    <div className="mx-auto max-w-[680px] px-4 py-10 md:py-14">
      <div className="text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          {confirmed ? <CheckCircle2 className="size-8" aria-hidden /> : <Users className="size-8 text-primary" aria-hidden />}
        </span>
        <h1 className="mt-5 text-[24px] font-bold text-ink md:text-[28px]">
          {confirmed ? "출발이 확정되었어요" : gathering ? "예약금 결제가 완료되었어요" : "예약이 접수되었어요"}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {confirmed
            ? "여행 준비 안내와 미팅 장소는 출발 7일 전 문자로 안내드려요."
            : gathering
              ? `${booking.theme.min_travelers}명 이상 모이면 확정되며, 입력하신 연락처로 문자를 보내드려요. 초대 코드는 방금 문자로도 보내드렸어요.`
              : "결제가 완료되면 예약이 확정 절차로 넘어가요."}
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[14px] shadow-[var(--shadow-card)]">
          <span className="text-muted">예약번호</span>
          <b className="tabular text-ink">{booking.code}</b>
          <Badge tone={st.tone}>{st.label}</Badge>
        </p>
      </div>

      {/* 예약 요약 */}
      <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <div className="flex gap-4">
          <Photo src={booking.package.hero_images[0]} alt={booking.package.title} className="size-[84px] shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-[12px] text-muted">
              {booking.theme.name} · {booking.package.region}
            </p>
            <p className="mt-0.5 text-[16px] font-bold leading-snug text-ink">{booking.package.title}</p>
            <p className="mt-1 text-[13px] tabular text-ink-2">
              {fullDate(booking.departure.depart_date)} ~ {fullDate(booking.departure.return_date)} · {duration(booking.package.nights, booking.package.days)}
            </p>
            <p className="text-[13px] text-ink-2">
              {STYLE_LABEL[booking.style_code]} 스타일 · {HOTEL_LABEL(booking.hotel_grade)} · {booking.travelers_count}명
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13.5px]">
          <div>
            <dt className="text-muted">총 여행 요금</dt>
            <dd className="text-[17px] font-bold tabular text-ink">{won(booking.quote.total)}</dd>
          </div>
          <div>
            <dt className="text-muted">결제한 예약금</dt>
            <dd className="text-[17px] font-bold tabular text-primary">{won(booking.quote.deposit)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-4">
        <ThemeBenefits perks={booking.theme.perks} transportLabel={TRANSPORT_LABEL[booking.transport_code]} travelersCount={booking.travelers_count} />
      </div>

      {/* 동행 모집 */}
      {gathering && booking.invite_code && (
        <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="text-[16px] font-bold text-ink">동행 모집 현황</h2>
          <GatheringProgress booking={booking} className="mt-3" />
          <InviteCode code={booking.invite_code} className="mt-5" />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-ink">회원이 아닌 분과 함께 가세요?</p>
              <p className="text-[12.5px] text-muted">이름과 연락처만 있으면 지금 바로 추가할 수 있어요.</p>
            </div>
            <AddTravelerForm booking={booking} onUpdated={setBooking} className="w-full sm:w-auto" />
          </div>
        </section>
      )}

      {confirmed && (
        <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-success-soft p-5 text-[14px] text-ink-2">
          <p className="font-bold text-success">출발이 확정되었어요. 문자로 안내드려요.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>기본 제공 물품은 결제 시 확보되며, 기념품과 서비스는 여행 안내·일정에 따라 제공됩니다.</li>
            <li>잔금 {won(booking.quote.total - booking.quote.deposit)}은 출발 7일 전까지 납부해 주세요.</li>
            <li>여행자 정보 변경은 마이페이지에서 출발 3일 전까지 가능합니다.</li>
          </ul>
        </section>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/me/bookings/${booking.id}`}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
        >
          내 예약 보기
        </Link>
        <Button variant="outline" size="lg" className="flex-1" onClick={() => router.push("/")} aria-label="홈으로">
          홈으로
        </Button>
      </div>
    </div>
  );
}
