"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, UserRound, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Booking, InvitePreview } from "@/lib/types";
import { BOOKING_STATUS, fullDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { NotFoundBlock } from "./not-found-block";
import { GatheringProgress } from "./invite-block";
import { loginHref } from "./utils";

export function JoinPage({ code }: { code: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [joined, setJoined] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  // 백엔드 400(본인 예약·이미 합류·모집 종료 등)은 토스트가 사라진 뒤에도 버튼 아래에 남겨 둔다
  const [joinError, setJoinError] = useState<string | null>(null);
  const upper = code.toUpperCase();

  useEffect(() => {
    let alive = true;
    api.bookings
      .invitePreview(upper)
      .then((p) => alive && setPreview(p))
      .catch((err: unknown) => {
        if (!alive) return;
        if (!(err instanceof ApiError && err.status === 404)) {
          toast(err instanceof Error ? err.message : "초대 정보를 불러오지 못했어요", "error");
        }
        setPreview(null);
      });
    return () => {
      alive = false;
    };
  }, [upper, toast]);

  const join = async () => {
    setBusy(true);
    setJoinError(null);
    try {
      const b = await api.bookings.join(upper);
      setJoined(b);
      toast(b.status === "confirmed" ? "인원이 모여 출발이 확정되었어요" : "동행으로 합류했어요", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "합류하지 못했어요";
      setJoinError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (preview === null) {
    return (
      <NotFoundBlock
        title="유효하지 않은 초대 코드예요"
        description="코드를 다시 확인해 주세요. 이미 확정되었거나 취소된 예약의 코드는 사용할 수 없어요."
        backHref="/"
        backLabel="홈으로"
      />
    );
  }

  if (preview === undefined) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-12" aria-busy="true">
        <Skeleton className="mx-auto h-14 w-14 rounded-full" />
        <Skeleton className="mx-auto mt-5 h-7 w-64" />
        <Skeleton className="mt-8 h-[220px] w-full rounded-[var(--radius-card)]" />
      </div>
    );
  }

  // ── 합류 완료
  if (joined) {
    const st = BOOKING_STATUS[joined.status];
    const confirmed = joined.status === "confirmed";
    return (
      <div className="mx-auto max-w-[560px] px-4 py-12 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <h1 className="mt-5 text-[24px] font-bold text-ink">{confirmed ? "출발이 확정되었어요" : "동행으로 합류했어요"}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {confirmed
            ? "모든 인원이 모였어요. 대표자와 동행 모두에게 확정 문자를 보내드렸어요."
            : `${joined.needed_more}명이 더 모이면 확정되며, 확정되는 즉시 문자로 알려드려요.`}
        </p>
        <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] text-muted">{joined.theme.name}</p>
              <p className="mt-0.5 text-[16px] font-bold text-ink">{joined.package.title}</p>
              <p className="mt-1 text-[13px] tabular text-ink-2">
                {fullDate(joined.departure.depart_date)} 출발 · 대표자 {joined.customer.name}
              </p>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <GatheringProgress booking={joined} className="mt-4" />
        </section>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/me/bookings/${joined.id}`}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
          >
            예약 상세 보기
          </Link>
          <Button variant="outline" size="lg" className="flex-1" onClick={() => router.push("/")} aria-label="홈으로">
            홈으로
          </Button>
        </div>
      </div>
    );
  }

  const needed = preview.needed_more;
  const pct = Math.min(100, Math.round((preview.travelers_count / preview.min_travelers) * 100));
  const nextHref = `/join/${upper}`;

  return (
    <div className="mx-auto max-w-[560px] px-4 py-10 md:py-14">
      <div className="text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Users className="size-8" aria-hidden />
        </span>
        <p className="mt-5 text-[13px] font-semibold text-primary">동행 초대</p>
        <h1 className="mt-1 text-[24px] font-bold leading-snug text-ink md:text-[28px]">
          {preview.representative_name}님이 함께 여행 가자고 초대했어요
        </h1>
      </div>

      <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <p className="text-[12px] text-muted">{preview.theme_name}</p>
        <p className="mt-0.5 text-[18px] font-bold leading-snug text-ink">{preview.package_title}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[13.5px]">
          <div>
            <dt className="text-muted">출발일</dt>
            <dd className="font-semibold tabular text-ink">{fullDate(preview.depart_date)}</dd>
          </div>
          <div>
            <dt className="text-muted">대표자</dt>
            <dd className="font-semibold text-ink">{preview.representative_name}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-baseline justify-between text-[14px]">
            <span className="font-bold tabular text-ink">
              {preview.travelers_count}/{preview.min_travelers}명
            </span>
            <span className="text-[13px] text-muted">{needed > 0 ? `${needed}명 더 모이면 확정돼요` : "인원이 모였어요"}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={preview.min_travelers} aria-valuenow={preview.travelers_count}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="mt-3 text-[12.5px] text-muted">초대 코드 <b className="tabular text-ink-2">{upper}</b> · 합류하면 회원 정보(이름·연락처)로 여행자 명단에 추가돼요.</p>
      </section>

      <div className="mt-6">
        {authLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : user ? (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-input)] bg-bg px-3.5 py-2.5 text-[13.5px] text-ink-2">
              <UserRound className="size-4 text-muted" aria-hidden />
              <span>
                <b className="text-ink">{user.name}</b> ({user.phone}) 으로 합류합니다
              </span>
            </div>
            <Button size="lg" full onClick={join} loading={busy} disabled={busy} aria-label="동행으로 합류하기">
              동행으로 합류하기
            </Button>
            {joinError && (
              <p className="mt-3 flex items-start gap-2 rounded-[var(--radius-input)] bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger" role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {joinError}
                  <Link href="/me" className="ml-1 font-semibold underline">
                    내 예약 보기
                  </Link>
                </span>
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-center text-[14px] text-muted">합류하려면 로그인이 필요해요. 처음이라면 1분 만에 가입할 수 있어요.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={loginHref(nextHref)}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
              >
                로그인하고 합류
              </Link>
              <Link
                href={`/signup?next=${encodeURIComponent(nextHref)}`}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-btn)] border border-line-strong bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-bg"
              >
                회원가입
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
