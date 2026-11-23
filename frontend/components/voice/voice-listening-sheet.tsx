"use client";

import { clsx } from "clsx";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * 듣는 중 상태 시트. 5개의 막대가 .voice-bar 애니메이션으로 움직인다.
 * `processing` 이면 인식이 끝나고 서버에서 뜻을 해석하는 중 (막대 정지 + "알아듣는 중…").
 */
export function VoiceListeningSheet({
  open,
  onCancel,
  interim,
  processing = false,
}: {
  open: boolean;
  onCancel: () => void;
  /** 인식 중 중간 결과 (있으면 표시) */
  interim?: string;
  processing?: boolean;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="음성 명령" size="sm">
      <div className="flex flex-col items-center py-6" aria-live="polite">
        <div className="flex h-16 items-center gap-1.5" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={clsx("block w-2 rounded-full bg-primary", processing ? "opacity-40" : "voice-bar")}
              style={{ height: processing ? 20 : [28, 44, 60, 44, 28][i], animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <p className="mt-5 text-[17px] font-bold text-ink">{processing ? "알아듣는 중…" : "듣고 있어요…"}</p>
        <p className="mt-1 min-h-[22px] text-center text-[14px] text-muted">
          {interim ? `“${interim}”` : "예) 둘이서 로맨틱하게 5일 · 그랜드로 바꿔 · 예약해줘"}
        </p>
        <Button variant="outline" className="mt-6" onClick={onCancel} aria-label="음성 명령 취소">
          취소
        </Button>
      </div>
    </Modal>
  );
}
