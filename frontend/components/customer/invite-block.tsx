"use client";

import { useState, useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { Check, Copy, Share2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { TravelerForm, emptyTraveler, toTravelerIn, travelerValid, type TravelerDraft } from "./traveler-form";

/** "2/3명 · 1명 더 모이면 확정돼요" 진행바 */
export function GatheringProgress({ booking, className }: { booking: Booking; className?: string }) {
  const min = booking.theme.min_travelers;
  const cur = booking.travelers_count;
  const pct = Math.min(100, Math.round((cur / min) * 100));
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="font-bold tabular text-ink">
          {cur}/{min}명
        </span>
        <span className="text-[13px] text-muted">
          {booking.needed_more > 0 ? `${booking.needed_more}명 더 모이면 확정돼요` : "인원이 모였어요"}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={min} aria-valuenow={cur} aria-label="동행 모집 진행">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** 초대 코드 + 복사 + 링크 공유 */
export function InviteCode({ code, className }: { code: string; className?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const link = `${origin}/join/${code}`;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast(`${label}를 복사했어요`, "success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("복사에 실패했어요. 직접 선택해 복사해 주세요", "error");
    }
  };

  const share = async () => {
    const data = { title: "미스터 월드 동행 초대", text: `함께 여행 가요! 초대 코드 ${code}`, url: link };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* 사용자가 취소 */
        return;
      }
    }
    copy(link, "초대 링크");
  };

  return (
    <div className={clsx("rounded-[var(--radius-card)] border border-dashed border-primary/50 bg-primary-soft/60 p-4", className)}>
      <p className="text-[12px] font-semibold text-primary">초대 코드</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-[30px] font-bold tracking-[0.18em] tabular text-primary-dark" aria-label={`초대 코드 ${code.split("").join(" ")}`}>
          {code}
        </p>
        <button
          type="button"
          onClick={() => copy(code, "초대 코드")}
          aria-label="초대 코드 복사"
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-btn)] bg-surface px-3 text-[13px] font-semibold text-primary shadow-[var(--shadow-card)] hover:bg-white"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <p className="mt-2 break-all text-[12.5px] tabular text-ink-2">{link}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" onClick={share} aria-label="초대 링크 공유">
          <Share2 className="size-4" aria-hidden /> 링크 공유
        </Button>
        <Button variant="ghost" size="sm" onClick={() => copy(link, "초대 링크")} aria-label="초대 링크 복사">
          링크 복사
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-muted">동행이 로그인 후 이 링크로 들어오면 자기 정보로 바로 합류돼요.</p>
    </div>
  );
}

/** 대표자가 동행을 직접 추가하는 폼 (비회원 포함) */
export function AddTravelerForm({ booking, onUpdated, className }: { booking: Booking; onUpdated: (b: Booking) => void; className?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TravelerDraft>(emptyTraveler(false));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!travelerValid(draft)) {
      toast("이름과 연락처를 정확히 입력해 주세요", "error");
      return;
    }
    setBusy(true);
    try {
      const b = await api.bookings.addTraveler(booking.id, toTravelerIn(draft));
      onUpdated(b);
      setDraft(emptyTraveler(false));
      setOpen(false);
      toast(b.status === "confirmed" ? "인원이 모여 출발이 확정되었어요" : "동행을 추가했어요", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "동행을 추가하지 못했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className={className} aria-label="동행 직접 추가">
        <UserPlus className="size-4" aria-hidden /> 직접 추가
      </Button>
    );
  }

  return (
    <div className={className}>
      <TravelerForm index={booking.travelers_count} value={draft} onChange={setDraft} compact />
      <div className="mt-3 flex gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
          취소
        </Button>
        <Button onClick={submit} loading={busy} aria-label="동행 추가 저장">
          추가하기
        </Button>
      </div>
    </div>
  );
}
