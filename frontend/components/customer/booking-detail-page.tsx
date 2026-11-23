"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Crown, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Booking } from "@/lib/types";
import { BOOKING_STATUS, HOTEL_LABEL, MEAL_LABEL, STYLE_LABEL, TRANSPORT_LABEL, dateTime, duration, fullDate, won } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo, Skeleton } from "@/components/ui/misc";
import { NotFoundBlock } from "./not-found-block";
import { PriceSummary } from "./price-summary";
import { ThemeBenefits } from "./theme-benefits";
import { AddTravelerForm, GatheringProgress, InviteCode } from "./invite-block";
import { CancelBookingModal } from "./cancel-booking-modal";
import { loginHref } from "./utils";

const CANCELLABLE = new Set(["pending", "gathering", "confirmed"]);
const EDITABLE = new Set(["pending", "gathering"]);

export function BookingDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "transfer">("card");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(loginHref(`/me/bookings/${id}`));
      return;
    }
    let alive = true;
    api.bookings
      .get(id)
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
  }, [id, user, authLoading, router, toast]);

  const removeTraveler = async (tid: number) => {
    if (!booking) return;
    setRemoving(tid);
    try {
      const b = await api.bookings.removeTraveler(booking.id, tid);
      setBooking(b);
      toast("동행을 삭제했어요", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "삭제하지 못했어요", "error");
    } finally {
      setRemoving(null);
    }
  };

  const payPending = async () => {
    if (!booking || booking.status !== "pending" || paying) return;
    setPaying(true);
    setPaymentError(null);
    try {
      const paid = await api.bookings.pay(booking.id, paymentMethod);
      setBooking(paid);
      toast(paid.status === "confirmed" ? "예약금 결제가 완료되어 출발이 확정되었어요" : "예약금 결제가 완료되었어요", "success");
    } catch (error) {
      // A lost response can leave a paid booking behind. Reload its saved state
      // before offering another attempt, without creating another reservation.
      try {
        const saved = await api.bookings.get(booking.id);
        setBooking(saved);
        if (saved.paid_at && (saved.status === "confirmed" || saved.status === "gathering")) return;
      } catch {
        // Show the original error when reconciliation is temporarily unavailable.
      }
      setPaymentError(error instanceof Error ? error.message : "결제에 실패했어요");
    } finally {
      setPaying(false);
    }
  };

  if (booking === null) {
    return <NotFoundBlock title="예약을 찾을 수 없어요" description="본인 예약 또는 동행으로 참여한 예약만 볼 수 있어요." backHref="/me" backLabel="내 예약으로" />;
  }

  if (!booking || !user) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-8" aria-busy="true">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-8 w-2/3" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[360px] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-[280px] w-full rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  const st = BOOKING_STATUS[booking.status];
  const isOwner = booking.customer.id === user.id;
  const canEdit = isOwner && EDITABLE.has(booking.status);
  const canCancel = isOwner && CANCELLABLE.has(booking.status);

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 md:py-10">
      <Link href="/me" className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> 내 예약
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] tabular text-muted">예약번호 {booking.code}</p>
          <h1 className="mt-1 text-[24px] font-bold leading-tight text-ink md:text-[28px]">{booking.package.title}</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {booking.theme.name} · {booking.package.region}, {booking.package.country}
          </p>
        </div>
        <Badge tone={st.tone} className="text-[13px]">
          {st.label}
        </Badge>
      </header>

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10">
        <div className="min-w-0 space-y-4">
          {/* 일정·옵션 */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <div className="flex gap-4">
              <Photo src={booking.package.hero_images[0]} alt={booking.package.title} className="hidden size-[104px] shrink-0 rounded-xl sm:block" />
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
                <div>
                  <dt className="text-[12px] text-muted">출발 · 도착</dt>
                  <dd className="font-semibold tabular text-ink">
                    {fullDate(booking.departure.depart_date)}
                    <br />~ {fullDate(booking.departure.return_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">기간</dt>
                  <dd className="font-semibold tabular text-ink">{duration(booking.package.nights, booking.package.days)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">스타일</dt>
                  <dd className="font-semibold text-ink">
                    {STYLE_LABEL[booking.style_code]} · {HOTEL_LABEL(booking.hotel_grade)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">식사</dt>
                  <dd className="font-semibold text-ink">{MEAL_LABEL[booking.meal_code]}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">교통</dt>
                  <dd className="font-semibold text-ink">{TRANSPORT_LABEL[booking.transport_code]}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">추가옵션</dt>
                  <dd className="font-semibold text-ink">
                    {booking.addons.length ? booking.addons.map((a) => `${a.label} ×${a.qty}`).join(", ") : "없음"}
                  </dd>
                </div>
              </dl>
            </div>
            {booking.memo && <p className="mt-4 rounded-[var(--radius-input)] bg-bg px-3.5 py-2.5 text-[13.5px] text-ink-2">메모: {booking.memo}</p>}
            <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-[12.5px] tabular text-muted">
              <div>
                <dt className="inline">접수 </dt>
                <dd className="inline text-ink-2">{dateTime(booking.created_at)}</dd>
              </div>
              <div>
                <dt className="inline">예약금 결제 </dt>
                <dd className="inline text-ink-2">{dateTime(booking.paid_at)}</dd>
              </div>
              <div>
                <dt className="inline">출발 확정 </dt>
                <dd className="inline text-ink-2">{dateTime(booking.confirmed_at)}</dd>
              </div>
            </dl>
          </section>

          <ThemeBenefits perks={booking.theme.perks} transportLabel={TRANSPORT_LABEL[booking.transport_code]} travelersCount={booking.travelers_count} />

          {/* 여행자 */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-bold text-ink">
                여행자 <span className="text-[14px] tabular text-muted">{booking.travelers_count}명</span>
              </h2>
              {booking.status === "gathering" && <span className="text-[12.5px] text-muted">최소 {booking.theme.min_travelers}명</span>}
            </div>
            <ul className="mt-3 divide-y divide-line">
              {booking.travelers.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-bg text-[14px] font-bold text-ink-2">{t.name.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold text-ink">
                      {t.name}
                      {t.is_representative && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          <Crown className="size-3" aria-hidden /> 대표자
                        </span>
                      )}
                      {t.joined_via_code && <Badge tone="muted">초대 코드로 합류</Badge>}
                      {t.user_id && !t.is_representative && !t.joined_via_code && <Badge tone="muted">회원</Badge>}
                    </p>
                    <p className="text-[13px] tabular text-muted">
                      {t.phone}
                      {t.birth && ` · ${fullDate(t.birth)}`}
                    </p>
                  </div>
                  {canEdit && !t.is_representative && (
                    <button
                      type="button"
                      onClick={() => removeTraveler(t.id)}
                      disabled={removing === t.id}
                      aria-label={`${t.name} 삭제`}
                      className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-3 border-t border-line pt-4">
                <AddTravelerForm booking={booking} onUpdated={setBooking} />
              </div>
            )}
          </section>

          {/* 동행 초대 */}
          {booking.status === "gathering" && booking.invite_code && (
            <section id="invite" className="scroll-mt-24 rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <h2 className="text-[16px] font-bold text-ink">동행 초대</h2>
              <GatheringProgress booking={booking} className="mt-3" />
              <InviteCode code={booking.invite_code} className="mt-4" />
            </section>
          )}
        </div>

        {/* 가격 */}
        <aside className="mt-4 lg:mt-0">
          <div className="sticky top-[88px] space-y-3">
            <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <h2 className="text-[16px] font-bold text-ink">결제 내역</h2>
              <PriceSummary quote={booking.quote} className="mt-3" compact />
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3 text-[13px]">
                <span className="text-muted">잔금 (출발 7일 전까지)</span>
                <span className="font-semibold tabular text-ink">{won(booking.quote.total - booking.quote.deposit)}</span>
              </div>
            </section>
            {isOwner && booking.status === "pending" && (
              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                <h2 className="text-[16px] font-bold text-ink">예약금 결제 대기</h2>
                <p className="mt-2 text-[13px] text-muted">예약금 결제를 마치면 인원에 따라 출발 확정 또는 동행 모집으로 바뀝니다. 결제는 시뮬레이션이며 실제 청구되지 않습니다.</p>
                <label className="mt-3 block text-[13px] font-semibold text-ink" htmlFor="pending-payment-method">결제 수단</label>
                <select id="pending-payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "card" | "transfer")} disabled={paying} className="mt-1 h-11 w-full rounded-[var(--radius-input)] border border-line bg-surface px-3 text-[14px]">
                  <option value="card">신용·체크카드</option>
                  <option value="transfer">계좌이체</option>
                </select>
                <Button full className="mt-3" onClick={payPending} loading={paying}>예약금 {won(booking.quote.deposit)} 결제하기</Button>
                {paymentError && <p className="mt-2 text-[13px] text-danger" role="alert">{paymentError}</p>}
              </section>
            )}
            {canCancel && (
              <Button variant="outline" full onClick={() => setCancelOpen(true)} className="text-danger hover:bg-danger-soft" aria-label="예약 취소">
                예약 취소
              </Button>
            )}
            <Link
              href={`/packages/${booking.package.id}`}
              className="block text-center text-[13px] font-semibold text-muted hover:text-ink"
            >
              상품 상세 다시 보기
            </Link>
          </div>
        </aside>
      </div>

      <CancelBookingModal
        booking={cancelOpen ? booking : null}
        onClose={() => setCancelOpen(false)}
        onCancelled={(b) => {
          setBooking(b);
          setCancelOpen(false);
        }}
      />
    </div>
  );
}
