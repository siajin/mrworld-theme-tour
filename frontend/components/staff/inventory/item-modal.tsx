"use client";

import { useState } from "react";
import { errMsg } from "@/components/staff/lib";
import { Switch } from "@/components/staff/ui/switch";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { InventoryItem, InventoryItemIn } from "@/lib/types";

export interface ItemModalState {
  item?: InventoryItem;
}

const CATEGORIES = ["기념품", "골프", "아웃도어", "객실", "이용권", "기타"];

interface Props {
  state: ItemModalState | null;
  onClose: () => void;
  onSaved: (it: InventoryItem, mode: "create" | "update") => void;
}

export function ItemModal({ state, onClose, onSaved }: Props) {
  if (!state) return null;
  return (
    <ItemModalInner
      key={state.item?.id ?? "new"}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ItemModalInner({
  state,
  onClose,
  onSaved,
}: Props & { state: ItemModalState }) {
  const toast = useToast();
  const it = state.item;
  const [sku, setSku] = useState(it?.sku ?? "");
  const [name, setName] = useState(it?.name ?? "");
  const [category, setCategory] = useState(it?.category ?? "");
  const [unit, setUnit] = useState(it?.unit ?? "개");
  const [stock, setStock] = useState(String(it?.stock_qty ?? 0));
  const [reorder, setReorder] = useState(String(it?.reorder_level ?? 0));
  const [active, setActive] = useState(it?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!sku.trim()) e.sku = "SKU를 입력해 주세요";
    if (!name.trim()) e.name = "물품명을 입력해 주세요";
    const st = Number(stock);
    const ro = Number(reorder);
    if (!state?.item && (stock === "" || !Number.isInteger(st) || st < 0))
      e.stock = "0 이상의 정수";
    if (reorder === "" || !Number.isInteger(ro) || ro < 0)
      e.reorder = "0 이상의 정수";
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: InventoryItemIn = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim() || "개",
      reorder_level: ro,
      is_active: active,
      ...(state?.item
        ? { stock_qty: state.item.stock_qty }
        : { stock_qty: st }),
    };
    setBusy(true);
    try {
      if (state?.item) {
        const it = await api.staff.inventory.updateItem(state.item.id, body);
        toast("물품 정보를 저장했어요", "success");
        onSaved(it, "update");
      } else {
        const it = await api.staff.inventory.createItem(body);
        toast("물품을 등록했어요", "success");
        onSaved(it, "create");
      }
      onClose();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={state.item ? "물품 수정" : "새 물품"}
      size="sm"
      sheetOnMobile={false}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <Switch
              checked={active}
              onChange={setActive}
              label="물품 활성"
              size="sm"
            />
            {active ? "활성" : "비활성"}
          </div>
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
              저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU" required error={errors.sku}>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="CPL-TEE"
            className="font-mono uppercase"
            autoFocus
          />
        </Field>
        <Field label="단위">
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="개 / 세트 / 장"
          />
        </Field>
        <Field
          label="물품명"
          required
          error={errors.name}
          className="col-span-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 커플 기념티"
          />
        </Field>
        <Field label="카테고리" className="col-span-2">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="기념품"
            list="inv-categories"
          />
          <datalist id="inv-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field
          label="초기 재고"
          error={errors.stock}
          hint={state?.item ? "재고는 입고/출고/조정으로 변경해요" : undefined}
        >
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={stock}
            disabled={!!state?.item}
            onChange={(e) => setStock(e.target.value)}
          />
        </Field>
        <Field
          label="안전재고"
          required
          error={errors.reorder}
          hint="이 수량 이하로 떨어지면 부족 표시"
        >
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={reorder}
            onChange={(e) => setReorder(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
