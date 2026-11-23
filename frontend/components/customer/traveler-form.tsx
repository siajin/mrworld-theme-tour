"use client";

import { clsx } from "clsx";
import { Crown, X } from "lucide-react";
import type { TravelerIn } from "@/lib/types";
import { phoneFormat } from "@/lib/format";
import { Field, Input } from "@/components/ui/field";

export type TravelerDraft = Required<Pick<TravelerIn, "name" | "phone">> & { birth: string; is_representative: boolean };

export const emptyTraveler = (rep = false): TravelerDraft => ({ name: "", phone: "", birth: "", is_representative: rep });

export function travelerValid(t: TravelerDraft) {
  return t.name.trim().length >= 2 && t.phone.replace(/\D/g, "").length >= 10;
}

export function toTravelerIn(t: TravelerDraft): TravelerIn {
  return { name: t.name.trim(), phone: t.phone, birth: t.birth || null, is_representative: t.is_representative };
}

/** 여행자 1명 입력 폼 (이름 / 연락처 / 생년월일) */
export function TravelerForm({
  index,
  value,
  onChange,
  onRemove,
  compact = false,
  className,
}: {
  index: number;
  value: TravelerDraft;
  onChange: (v: TravelerDraft) => void;
  /** 동행 제거 버튼 (대표자에게는 넘기지 않는다) */
  onRemove?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const set = (k: keyof TravelerDraft, v: string) => onChange({ ...value, [k]: v });
  return (
    <fieldset className={clsx("rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5", className)}>
      <legend className="sr-only">여행자 {index + 1}</legend>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-bg text-[12px] font-bold tabular text-ink-2">{index + 1}</span>
        <span className="text-[15px] font-bold text-ink">{value.is_representative ? "대표 여행자" : `동행 ${index}`}</span>
        {value.is_representative && (
          <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            <Crown className="size-3" aria-hidden /> 예약자
          </span>
        )}
        {!value.is_representative && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`동행 ${index} 제거`}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[13px] font-semibold text-muted hover:bg-danger-soft hover:text-danger"
          >
            <X className="size-4" aria-hidden /> 제거
          </button>
        )}
      </div>
      <div className={clsx("grid gap-3", compact ? "sm:grid-cols-3" : "sm:grid-cols-[1fr_1fr_1fr]")}>
        <Field label="이름" required>
          <Input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="여권과 같은 이름"
            autoComplete={value.is_representative ? "name" : "off"}
            required
            aria-label={`여행자 ${index + 1} 이름`}
          />
        </Field>
        <Field label="연락처" required hint={compact ? undefined : "예약 접수·출발 확정 문자를 이 번호로 보내드려요"}>
          <Input
            type="tel"
            inputMode="numeric"
            value={value.phone}
            onChange={(e) => set("phone", phoneFormat(e.target.value))}
            placeholder="010-0000-0000"
            required
            aria-label={`여행자 ${index + 1} 연락처`}
          />
        </Field>
        <Field label="생년월일" hint={compact ? undefined : "항공권 발권용 (선택)"}>
          <Input
            type="date"
            value={value.birth}
            max="2026-12-31"
            onChange={(e) => set("birth", e.target.value)}
            className="tabular"
            aria-label={`여행자 ${index + 1} 생년월일`}
          />
        </Field>
      </div>
    </fieldset>
  );
}
