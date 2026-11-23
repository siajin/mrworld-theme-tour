"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { AIParseResult } from "@/lib/types";
import { STYLE_LABEL } from "@/lib/format";

const THEME_SHORT: Record<string, string> = { honeymoon: "허니문", parents: "효도", golf: "골프", trekking: "트레킹" };

/** 검색 의도일 때 확인 시트에 보여 줄 칩 (테마/지역/시기/인원/스타일) */
export function searchChips(r: AIParseResult): string[] {
  const chips: string[] = [];
  const themeName = r.theme_slug ? (THEME_SHORT[r.theme_slug] ?? r.theme_slug) : null;
  if (themeName) chips.push(themeName);
  if (r.region) chips.push(r.region);
  if (r.depart_from) {
    const from = r.depart_from.slice(5).replace("-", ".");
    const to = r.depart_to ? r.depart_to.slice(5).replace("-", ".") : null;
    chips.push(to && to !== from ? `${from}~${to}` : `${from} 출발`);
  }
  if (r.travelers_count) chips.push(`${r.travelers_count}명`);
  if (r.style_code) chips.push(`${STYLE_LABEL[r.style_code]} 스타일`);
  if (r.budget_max) chips.push(`${Math.round(r.budget_max / 10000)}만원 이하`);
  return chips;
}

/**
 * 인식 결과 확인 시트.
 * 백엔드가 만들어 준 확인 문장(`result.reply`)을 그대로 묻는다: "허니문 · 2명(으)로 검색할까요?" → 네 / 다시
 * `mode="unknown"` 이면 실행 버튼 없이 "다시 말하기 / 닫기" 만 보여 준다.
 */
export function VoiceConfirmSheet({
  open,
  transcript,
  result,
  mode = "confirm",
  onConfirm,
  onRetry,
  onClose,
}: {
  open: boolean;
  /** 사용자가 말한 원문 */
  transcript: string;
  /** /ai/parse 결과 (없으면 원문만 보여 준다) */
  result: AIParseResult | null;
  mode?: "confirm" | "unknown";
  onConfirm: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const question = result?.reply?.trim() || "이렇게 들렸어요. 이대로 진행할까요?";
  const chips = result && result.intent === "search" ? searchChips(result) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "unknown" ? "잘 못 알아들었어요" : "인식 결과 확인"}
      size="sm"
      footer={
        mode === "unknown" ? (
          <div className="flex gap-2">
            <Button variant="outline" full onClick={onClose} aria-label="닫기">
              닫기
            </Button>
            <Button full onClick={onRetry} aria-label="다시 말하기">
              다시 말하기
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" full onClick={onRetry} aria-label="다시 말하기">
              다시
            </Button>
            <Button full onClick={onConfirm} aria-label="네, 실행">
              네
            </Button>
          </div>
        )
      }
    >
      <div className="py-2">
        <p className="text-[13px] text-muted">들은 내용</p>
        <p className="mt-1 rounded-[var(--radius-input)] bg-bg px-3.5 py-3 text-[15px] text-ink-2">“{transcript}”</p>
        <p className="mt-4 text-[17px] font-bold leading-snug text-ink" aria-live="polite">
          {question}
        </p>
        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="인식된 조건">
            {chips.map((k) => (
              <li key={k} className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary">
                {k}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
