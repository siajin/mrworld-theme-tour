"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export interface ConfirmState {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => Promise<void> | void;
}

/** 파괴적/중요 작업 확인 다이얼로그. `state` 가 null 이면 닫힘. */
export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const open = state !== null;

  const run = async () => {
    if (!state) return;
    setBusy(true);
    try {
      await state.onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={state?.title}
      size="sm"
      sheetOnMobile={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            variant={state?.tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={run}
            loading={busy}
          >
            {state?.confirmLabel ?? "확인"}
          </Button>
        </div>
      }
    >
      <div className="text-[14px] leading-relaxed text-ink-2">
        {state?.description ?? "이 작업을 진행할까요?"}
      </div>
    </Modal>
  );
}
