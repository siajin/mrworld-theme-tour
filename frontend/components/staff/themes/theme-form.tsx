"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { errMsg, THEME_ICONS } from "@/components/staff/lib";
import { ThemeIcon } from "@/components/staff/theme-icon";
import { FieldGroup } from "@/components/staff/ui/field-group";
import { SingleImageInput } from "@/components/staff/ui/image-list";
import { Switch } from "@/components/staff/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { TRANSPORT_LABEL } from "@/lib/format";
import type { InventoryItem, Theme, ThemeIn, TransportCode } from "@/lib/types";

type PerkRow = {
  label: string;
  inventory_item_id: number | null;
  qty_per_booking: string;
  per_person: boolean;
};

interface FormState {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  hero_image: string;
  min_style_rank: 1 | 2 | 3;
  min_travelers: string;
  vehicle_label: string;
  default_transport: TransportCode;
  is_active: boolean;
  perks: PerkRow[];
}

function toForm(t?: Theme): FormState {
  return {
    slug: t?.slug ?? "",
    name: t?.name ?? "",
    tagline: t?.tagline ?? "",
    description: t?.description ?? "",
    icon: t?.icon || "sparkles",
    hero_image: t?.hero_image ?? "",
    min_style_rank: t?.min_style_rank ?? 1,
    min_travelers: String(t?.min_travelers ?? 3),
    vehicle_label: t?.vehicle_label ?? "",
    default_transport: t?.default_transport ?? "van_10",
    is_active: t?.is_active ?? true,
    perks: (t?.perks ?? []).map((p) => ({
      label: p.label,
      inventory_item_id: p.inventory_item_id,
      qty_per_booking: String(p.qty_per_booking),
      per_person: p.per_person,
    })),
  };
}

export interface ThemeFormState {
  theme?: Theme;
}

interface Props {
  state: ThemeFormState | null;
  items: InventoryItem[];
  onClose: () => void;
  onSaved: (t: Theme, mode: "create" | "update") => void;
}

export function ThemeFormModal({ state, items, onClose, onSaved }: Props) {
  if (!state) return null;
  return (
    <ThemeFormInner
      key={state.theme?.id ?? "new"}
      state={state}
      items={items}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function ThemeFormInner({
  state,
  items,
  onClose,
  onSaved,
}: Props & { state: ThemeFormState }) {
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => toForm(state.theme));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!state.theme);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const setPerk = (i: number, patch: Partial<PerkRow>) =>
    set(
      "perks",
      f.perks.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    );

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "테마 이름을 입력해 주세요";
    if (!f.slug.trim()) e.slug = "슬러그를 입력해 주세요";
    else if (!/^[a-z0-9-]+$/.test(f.slug))
      e.slug = "영문 소문자, 숫자, 하이픈만 쓸 수 있어요";
    const mt = Number(f.min_travelers);
    if (!f.min_travelers || !Number.isInteger(mt) || mt < 1)
      e.min_travelers = "1명 이상";
    f.perks.forEach((p, i) => {
      if (!p.label.trim()) e[`perk_${i}`] = "항목명을 입력해 주세요";
      else if (
        !Number.isInteger(Number(p.qty_per_booking)) ||
        Number(p.qty_per_booking) < 1
      )
        e[`perk_${i}`] = "수량은 1 이상";
    });
    setErrors(e);
    if (Object.keys(e).length) return;

    const body: ThemeIn = {
      slug: f.slug.trim(),
      name: f.name.trim(),
      tagline: f.tagline.trim(),
      description: f.description.trim(),
      icon: f.icon,
      hero_image: f.hero_image.trim(),
      min_style_rank: f.min_style_rank,
      min_travelers: mt,
      vehicle_label: f.vehicle_label.trim(),
      default_transport: f.default_transport,
      is_active: f.is_active,
      perks: f.perks.map((p) => ({
        label: p.label.trim(),
        inventory_item_id: p.inventory_item_id,
        qty_per_booking: Number(p.qty_per_booking),
        per_person: p.per_person,
      })),
    };
    setBusy(true);
    try {
      if (state.theme) {
        const t = await api.staff.themes.update(state.theme.id, body);
        toast("테마를 저장했어요", "success");
        onSaved(t, "update");
      } else {
        const t = await api.staff.themes.create(body);
        toast("테마를 추가했어요", "success");
        onSaved(t, "create");
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
      title={state.theme ? "테마 수정" : "새 테마"}
      size="lg"
      sheetOnMobile={false}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <Switch
              checked={f.is_active}
              onChange={(v) => set("is_active", v)}
              label="테마 활성"
              size="sm"
            />
            {f.is_active ? "활성 (고객에게 노출)" : "비활성 (숨김)"}
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
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="테마 이름" required error={errors.name}>
            <Input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="예: 쿠킹 클래스 투어"
              autoFocus
            />
          </Field>
          <Field
            label="슬러그"
            required
            error={errors.slug}
            hint="URL에 쓰여요 (영문 소문자)"
          >
            <Input
              value={f.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
              onBlur={() => !slugTouched && setSlugTouched(true)}
              placeholder="cooking"
              className="font-mono text-[14px]"
            />
          </Field>
        </div>
        <Field label="슬로건">
          <Input
            value={f.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="한 줄 소개 문구"
          />
        </Field>
        <Field label="설명">
          <Textarea
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            className="min-h-[80px]"
            placeholder="테마 페이지 상단에 들어가는 소개"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="아이콘">
            <div className="flex flex-wrap gap-1.5">
              {THEME_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  aria-label={ic}
                  aria-pressed={f.icon === ic}
                  onClick={() => set("icon", ic)}
                  className={
                    f.icon === ic
                      ? "inline-flex size-10 items-center justify-center rounded-lg border border-primary bg-primary-soft text-primary"
                      : "inline-flex size-10 items-center justify-center rounded-lg border border-line text-muted hover:border-line-strong hover:text-ink"
                  }
                >
                  <ThemeIcon name={ic} className="size-5" />
                </button>
              ))}
            </div>
          </FieldGroup>
          <FieldGroup label="대표 이미지">
            <SingleImageInput
              value={f.hero_image}
              onChange={(v) => set("hero_image", v)}
            />
          </FieldGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="최소 스타일"
            hint="이 등급 미만 스타일은 이 테마에서 판매하지 않아요"
          >
            <Select
              value={f.min_style_rank}
              onChange={(e) =>
                set("min_style_rank", Number(e.target.value) as 1 | 2 | 3)
              }
            >
              <option value={1}>클래식부터 (모든 스타일)</option>
              <option value={2}>그랜드부터</option>
              <option value={3}>프리미엄만</option>
            </Select>
          </Field>
          <Field
            label="최소 출발 인원"
            required
            error={errors.min_travelers}
            hint="예약 1건의 인원이 이 수에 도달하면 확정"
          >
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={f.min_travelers}
              onChange={(e) => set("min_travelers", e.target.value)}
            />
          </Field>
          <Field label="기본 차량">
            <Select
              value={f.default_transport}
              onChange={(e) =>
                set("default_transport", e.target.value as TransportCode)
              }
            >
              {(Object.keys(TRANSPORT_LABEL) as TransportCode[]).map((c) => (
                <option key={c} value={c}>
                  {TRANSPORT_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="차량 표시 문구" hint="고객 화면에 보이는 문구">
            <Input
              value={f.vehicle_label}
              onChange={(e) => set("vehicle_label", e.target.value)}
              placeholder="예: 10인승 고급 승합"
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink-2">
              기본 제공 물품·서비스
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set("perks", [
                  ...f.perks,
                  {
                    label: "",
                    inventory_item_id: null,
                    qty_per_booking: "1",
                    per_person: false,
                  },
                ])
              }
            >
              <Plus className="size-4" />
              항목 추가
            </Button>
          </div>
          <p className="mb-2 text-[12px] text-muted">
            결제 완료 또는 직원 확정 시 연결된 창고 물품을 차감합니다. 연출·체험 서비스는 창고 연결 없이 등록할 수 있어요.
          </p>
          {f.perks.length === 0 && (
            <p className="rounded-lg border border-dashed border-line-strong px-4 py-4 text-center text-[13px] text-muted">
              기본 제공 물품·서비스가 없어요.
            </p>
          )}
          <div className="space-y-2">
            {f.perks.map((p, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_180px_90px_auto_auto] sm:items-center">
                  <Input
                    value={p.label}
                    onChange={(e) => setPerk(i, { label: e.target.value })}
                    placeholder="항목명 (예: 커플 기념티)"
                    className="h-10"
                    aria-label="항목명"
                  />
                  <Select
                    value={p.inventory_item_id ?? ""}
                    onChange={(e) =>
                      setPerk(i, {
                        inventory_item_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className="h-10"
                    aria-label="연결 물품"
                  >
                    <option value="">창고 연결 없음</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.sku})
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={p.qty_per_booking}
                    onChange={(e) =>
                      setPerk(i, { qty_per_booking: e.target.value })
                    }
                    className="h-10 text-right tabular"
                    aria-label="수량"
                  />
                  <Checkbox
                    label="1인당"
                    checked={p.per_person}
                    onChange={(e) =>
                      setPerk(i, { per_person: e.target.checked })
                    }
                    className="whitespace-nowrap"
                  />
                  <button
                    type="button"
                    aria-label="삭제"
                    onClick={() =>
                      set(
                        "perks",
                        f.perks.filter((_, j) => j !== i),
                      )
                    }
                    className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {errors[`perk_${i}`] && (
                  <p className="mt-1 text-[12px] text-danger">
                    {errors[`perk_${i}`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
