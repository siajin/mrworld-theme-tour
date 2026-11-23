"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Booking } from "@/lib/types";
import { fullDate, won } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/** 예약 취소 확인 모달 */
export function CancelBookingModal({
  booking,
  onClose,
  onCancelled,
}: {
  booking: Booking | null;
  onClose: () => void;
  onCancelled: (b: Booking) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!booking) return;
    setBusy(true);
    try {
      const b = await api.bookings.cancel(booking.id);
      toast("예약을 취소했어요. 환불은 결제 수단으로 3~5일 내 처리돼요", "success");
      onCancelled(b);
    } catch (err) {
      toast(err instanceof Error ? err.message : "취소하지 못했어요", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!booking}
      onClose={onClose}
      title="예약을 취소할까요?"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" full onClick={onClose} disabled={busy}>
            돌아가기
          </Button>
          <Button variant="danger" full onClick={confirm} loading={busy} aria-label="예약 취소 확정">
            취소하기
          </Button>
        </div>
      }
    >
      {booking && (
        <div className="text-[14px] text-ink-2">
          <p className="font-semibold text-ink">{booking.package.title}</p>
          <p className="mt-0.5 tabular text-muted">
            {fullDate(booking.departure.depart_date)} 출발 · {booking.travelers_count}명 · {won(booking.quote.total)}
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[13.5px] leading-relaxed">
            <li>출발 30일 전까지는 예약금 {won(booking.quote.deposit)}이 전액 환불됩니다.</li>
            <li>동행이 있는 예약이면 동행에게도 취소 안내 문자가 발송됩니다.</li>
            <li>취소 후에는 되돌릴 수 없어요.</li>
          </ul>
        </div>
      )}
    </Modal>
  );
}
