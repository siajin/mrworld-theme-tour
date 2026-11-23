"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, LogOut, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Booking } from "@/lib/types";
import { LOYALTY_LABEL } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { BookingCard, BookingCardSkeleton } from "./booking-card";
import { CancelBookingModal } from "./cancel-booking-modal";
import { useVoiceContext } from "@/components/voice";
import { loginHref, todayIso } from "./utils";

type TabKey = "upcoming" | "past" | "cancelled";

export function MePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  useVoiceContext("me");

  useEffect(() => {
    if (!authLoading && !user) router.replace(loginHref("/me"));
  }, [authLoading, user, router]);

  const load = useCallback(() => {
    api.me
      .bookings()
      .then(setBookings)
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : "예약을 불러오지 못했어요", "error");
        setBookings([]);
      });
  }, [toast]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const groups = useMemo(() => {
    const today = todayIso();
    const list = bookings ?? [];
    const upcoming = list
      .filter((b) => b.status !== "cancelled" && b.status !== "completed" && b.departure.depart_date >= today)
      .sort((a, b) => a.departure.depart_date.localeCompare(b.departure.depart_date));
    const past = list
      .filter((b) => b.status === "completed" || (b.status !== "cancelled" && b.departure.depart_date < today))
      .sort((a, b) => b.departure.depart_date.localeCompare(a.departure.depart_date));
    const cancelled = list.filter((b) => b.status === "cancelled").sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { upcoming, past, cancelled };
  }, [bookings]);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-8" aria-busy="true">
        <Skeleton className="h-[140px] w-full rounded-[var(--radius-card)]" />
        <Skeleton className="mt-6 h-12 w-72" />
        <div className="mt-4 space-y-4">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      </div>
    );
  }

  const loyalty = user.loyalty;
  const tierTone = loyalty?.tier === "gold" ? "warning" : loyalty?.tier === "silver" ? "info" : "neutral";
  const current = groups[tab];

  const EMPTY: Record<TabKey, { title: string; desc: string }> = {
    upcoming: { title: "예정된 여행이 없어요", desc: "테마별 여행에서 다음 여행을 골라보세요." },
    past: { title: "지난 여행이 없어요", desc: "첫 여행을 다녀오면 여기에 기록이 남아요." },
    cancelled: { title: "취소한 예약이 없어요", desc: "" },
  };

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 md:py-10">
      {/* 프로필 카드 */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[22px] font-bold text-primary">
              {user.name.slice(0, 1)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold text-ink">{user.name}</h1>
                {loyalty && (
                  <Badge tone={tierTone}>
                    <Award className="size-3.5" aria-hidden />
                    {LOYALTY_LABEL[loyalty.tier]}
                  </Badge>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted">
                <span>{user.email}</span>
                <span className="inline-flex items-center gap-1 tabular">
                  <Phone className="size-3.5" aria-hidden />
                  {user.phone}
                </span>
                {user.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {user.address}
                  </span>
                )}
              </p>
            </div>
          </div>

          {loyalty && (
            <div className="rounded-[var(--radius-input)] bg-bg px-4 py-3 text-[13px] md:min-w-[280px]">
              <div className="flex items-baseline justify-between">
                <span className="text-muted">완료한 여행</span>
                <span className="font-bold tabular text-ink">{loyalty.completed_trips}회</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-muted">현재 할인율</span>
                <span className="font-bold tabular text-primary">{Math.round(loyalty.rate * 100)}%</span>
              </div>
              {loyalty.next_tier_trips != null ? (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((loyalty.completed_trips / loyalty.next_tier_trips) * 100))}%` }} />
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">
                    다음 등급까지 <b className="tabular text-ink">{loyalty.next_tier_trips - loyalty.completed_trips}회</b> 남았어요
                  </p>
                </>
              ) : (
                <p className="mt-2 text-[12px] text-muted">최고 등급이에요. 늘 감사합니다.</p>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end border-t border-line pt-3 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.push("/");
            }}
            aria-label="로그아웃"
          >
            <LogOut className="size-4" aria-hidden /> 로그아웃
          </Button>
        </div>
      </section>

      {/* 예약 탭 */}
      <Tabs<TabKey>
        className="mt-8 rounded-t-[var(--radius-card)]"
        value={tab}
        onChange={setTab}
        items={[
          { value: "upcoming", label: "예정 여행", count: bookings ? groups.upcoming.length : undefined },
          { value: "past", label: "지난 여행", count: bookings ? groups.past.length : undefined },
          { value: "cancelled", label: "취소", count: bookings ? groups.cancelled.length : undefined },
        ]}
      />

      <div className="mt-4 space-y-4">
        {bookings === null ? (
          <>
            <BookingCardSkeleton />
            <BookingCardSkeleton />
          </>
        ) : current.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface">
            <EmptyState
              title={EMPTY[tab].title}
              description={EMPTY[tab].desc || undefined}
              action={
                tab !== "cancelled" && (
                  <Link href="/themes" className="inline-flex h-10 items-center rounded-[var(--radius-btn)] bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover">
                    테마별 여행 보기
                  </Link>
                )
              }
            />
          </div>
        ) : (
          current.map((b) => <BookingCard key={b.id} booking={b} onCancel={tab === "upcoming" ? setCancelTarget : undefined} />)
        )}
      </div>

      <CancelBookingModal
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={(b) => {
          setBookings((prev) => prev?.map((x) => (x.id === b.id ? b : x)) ?? prev);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
