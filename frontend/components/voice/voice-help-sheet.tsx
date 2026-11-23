"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const EXAMPLES: { where: string; phrases: string[] }[] = [
  { where: "검색", phrases: ["부모님이랑 10월에 온천", "둘이서 로맨틱하게 5일", "골프 치러 넷이서"] },
  { where: "목록에서", phrases: ["두 번째 상품", "마지막 거"] },
  { where: "상품 상세에서", phrases: ["그랜드로 바꿔", "3명으로", "가장 빠른 출발일로", "5성 호텔로", "예약해줘"] },
  { where: "이동", phrases: ["뒤로", "홈으로", "내 예약"] },
];

/** "도움말" 의도: 예시 문장을 보여 주는 작은 시트 */
export function VoiceHelpSheet({ open, onClose, onRetry }: { open: boolean; onClose: () => void; onRetry: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="이렇게 말해 보세요"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" full onClick={onClose} aria-label="닫기">
            닫기
          </Button>
          <Button full onClick={onRetry} aria-label="말하기">
            말하기
          </Button>
        </div>
      }
    >
      <dl className="space-y-3 py-1">
        {EXAMPLES.map((g) => (
          <div key={g.where}>
            <dt className="text-[12px] font-semibold text-muted">{g.where}</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {g.phrases.map((p) => (
                <span key={p} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-2">
                  “{p}”
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
