"use client";

import { useState } from "react";
import { errMsg } from "@/components/staff/lib";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { InventoryItem, InventoryMove } from "@/lib/types";

type MoveType = InventoryMove["type"];

const HELP: Record<MoveType, string> = {
  in: "재고가 수량만큼 늘어나요.",
  out: "재고가 수량만큼 줄어들어요. 현재 재고보다 많이 출고할 수 없어요.",
  adjust: "실사 후 재고를 입력한 수량으로 맞춰요.",
};

interface Props {
  item: InventoryItem | null;
  initialType?: MoveType;
  onClose: () => void;
  onDone: (updated: InventoryItem) => void;
}

/** 입고/출고/조정 모달. 열릴 때마다 내부 폼을 새로 마운트해 초기화한다. */
export function MoveModal({
  item,
  initialType = "in",
  onClose,
  onDone,
}: Props) {
  if (!item) return null;
  return (
    <MoveModalInner
      key={`${item.id}-${initialType}`}
      item={item}
      initialType={initialType}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function MoveModalInner({
  item,
  initialType,
  onClose,
  onDone,
}: Props & { item: InventoryItem; initialType: MoveType }) {
  const toast = useToast();
  const [type, setType] = useState<MoveType>(initialType);
  const [qty, setQty] = useState(
    initialType === "adjust" ? String(item.stock_qty) : "",
  );
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number(qty);
  const after =
    type === "in"
      ? item.stock_qty + n
      : type === "out"
        ? item.stock_qty - n
        : n;

  const submit = async () => {
    if (!qty.trim() || Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
      setError("0 이상의 정수를 입력해 주세요");
      return;
    }
    if (type !== "adjust" && n === 0) {
      setError("수량은 1 이상이어야 해요");
      return;
    }
    if (type === "out" && n > item.stock_qty) {
      setError(
        `현재 재고(${item.stock_qty}${item.unit})보다 많이 출고할 수 없어요`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await api.staff.inventory.move(item.id, {
        type,
        qty: n,
        memo: memo.trim(),
      });
      toast(
        `${item.name} ${type === "in" ? "입고" : type === "out" ? "출고" : "조정"} 처리했어요`,
        "success",
      );
      onDone(updated);
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`${item.name} · 재고 이동`}
      size="sm"
      sheetOnMobile={false}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted tabular">
            현재 {item.stock_qty}
            {item.unit} →{" "}
            <b className="text-ink">{Number.isNaN(after) ? "-" : after}</b>
            {item.unit}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={busy}
            >
              취소
            </Button>
            <Button size="sm" onClick={submit} loading={busy}>
              {type === "in"
                ? "입고 처리"
                : type === "out"
                  ? "출고 처리"
                  : "조정 저장"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Segmented<MoveType>
            items={[
              { value: "in", label: "입고" },
              { value: "out", label: "출고" },
              { value: "adjust", label: "조정" },
            ]}
            value={type}
            onChange={(t) => {
              setType(t);
              setQty(t === "adjust" ? String(item.stock_qty) : "");
              setError(null);
            }}
          />
          <p className="mt-2 text-[12px] text-muted">{HELP[type]}</p>
        </div>
        <Field
          label={type === "adjust" ? "실제 재고 수량" : "수량"}
          required
          error={error ?? undefined}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            autoFocus
          />
        </Field>
        <Field label="메모">
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder={
              type === "in"
                ? "예: 9월 정기 입고"
                : type === "out"
                  ? "예: 파손 폐기"
                  : "예: 월말 실사 반영"
            }
            className="min-h-[72px]"
          />
        </Field>
      </div>
    </Modal>
  );
}
