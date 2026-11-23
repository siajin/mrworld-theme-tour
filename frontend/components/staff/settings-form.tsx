"use client";

import { useCallback, useState } from "react";
import { errMsg } from "@/components/staff/lib";
import { PageHeader } from "@/components/staff/ui/page-header";
import { useLoad } from "@/components/staff/use-load";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";

interface FormState {
  min_travelers_default: string;
  loyalty_silver_trips: string;
  loyalty_silver_rate: string; // %
  loyalty_gold_trips: string;
  loyalty_gold_rate: string; // %
  deposit_rate: string; // %
}

const pct = (r: number) => String(Math.round(r * 1000) / 10);

function toForm(s: Settings): FormState {
  return {
    min_travelers_default: String(s.min_travelers_default),
    loyalty_silver_trips: String(s.loyalty_silver_trips),
    loyalty_silver_rate: pct(s.loyalty_silver_rate),
    loyalty_gold_trips: String(s.loyalty_gold_trips),
    loyalty_gold_rate: pct(s.loyalty_gold_rate),
    deposit_rate: pct(s.deposit_rate),
  };
}

function SettingRow({
  label,
  description,
  children,
  error,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="grid gap-3 border-b border-line py-5 last:border-b-0 md:grid-cols-[1fr_260px] md:items-start">
      <div>
        <p className="text-[15px] font-semibold text-ink">{label}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      </div>
      <div>
        {children}
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
    </div>
  );
}

export function SettingsForm() {
  const load = useCallback(() => api.staff.settings.get(), []);
  const { data, setData, loading } = useLoad(load);
  if (loading || !data) {
    return (
      <>
        <PageHeader
          title="설정"
          description="예약 확정 기준과 단골 할인, 예약금 비율을 관리합니다."
        />
        <Card className="max-w-[880px] px-6">
          <div className="space-y-6 py-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-[1fr_260px]">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <Skeleton className="h-11" />
              </div>
            ))}
          </div>
        </Card>
      </>
    );
  }
  // 서버 값이 바뀌면 key 로 폼을 다시 마운트
  return (
    <SettingsEditor
      key={JSON.stringify(data)}
      initial={data}
      onSaved={setData}
    />
  );
}

function SettingsEditor({
  initial,
  onSaved,
}: {
  initial: Settings;
  onSaved: (s: Settings) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FormState, v: string) =>
    setF((prev) => ({ ...prev, [k]: v }));
  const dirty = JSON.stringify(toForm(initial)) !== JSON.stringify(f);

  const save = async () => {
    const e: Record<string, string> = {};
    const intField = (k: keyof FormState, min: number) => {
      const n = Number(f[k]);
      if (f[k] === "" || !Number.isInteger(n) || n < min)
        e[k] = `${min} 이상의 정수를 입력해 주세요`;
      return n;
    };
    const pctField = (k: keyof FormState) => {
      const n = Number(f[k]);
      if (f[k] === "" || Number.isNaN(n) || n < 0 || n > 100)
        e[k] = "0~100 사이의 %를 입력해 주세요";
      return n / 100;
    };
    const body: Settings = {
      min_travelers_default: intField("min_travelers_default", 1),
      loyalty_silver_trips: intField("loyalty_silver_trips", 0),
      loyalty_silver_rate: pctField("loyalty_silver_rate"),
      loyalty_gold_trips: intField("loyalty_gold_trips", 0),
      loyalty_gold_rate: pctField("loyalty_gold_rate"),
      deposit_rate: pctField("deposit_rate"),
    };
    if (
      !e.loyalty_gold_trips &&
      !e.loyalty_silver_trips &&
      body.loyalty_gold_trips < body.loyalty_silver_trips
    )
      e.loyalty_gold_trips = "골드 기준은 실버 기준 이상이어야 해요";
    if (
      !e.loyalty_gold_rate &&
      !e.loyalty_silver_rate &&
      body.loyalty_gold_rate < body.loyalty_silver_rate
    )
      e.loyalty_gold_rate = "골드 할인율은 실버 할인율 이상이어야 해요";
    setErrors(e);
    if (Object.keys(e).length) {
      toast("입력값을 확인해 주세요", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api.staff.settings.update(body);
      onSaved(res);
      toast("설정을 저장했어요", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="설정"
        description="예약 확정 기준과 단골 할인, 예약금 비율을 관리합니다. 변경 즉시 새 견적부터 적용돼요."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => setF(toForm(initial))}
            >
              되돌리기
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              저장
            </Button>
          </>
        }
      />
      <Card className="max-w-[880px] px-6">
        <SettingRow
          label="기본 최소 출발 인원"
          description="새 테마를 만들 때 기본으로 들어가는 최소 출발 인원입니다. 예약 1건(대표자+동행)의 인원이 테마별 최소 인원에 도달하면 자동 확정됩니다."
          error={errors.min_travelers_default}
        >
          <Field>
            <div className="relative">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={f.min_travelers_default}
                onChange={(e) => set("min_travelers_default", e.target.value)}
                className="pr-10 text-right tabular"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                명
              </span>
            </div>
          </Field>
        </SettingRow>
        <SettingRow
          label="실버 단골 기준"
          description="완료한 여행이 이 횟수 이상이면 실버 단골이 되어 아래 할인율이 적용됩니다."
          error={errors.loyalty_silver_trips ?? errors.loyalty_silver_rate}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="완료 여행">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={f.loyalty_silver_trips}
                  onChange={(e) => set("loyalty_silver_trips", e.target.value)}
                  className="pr-8 text-right tabular"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                  회
                </span>
              </div>
            </Field>
            <Field label="할인율">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  inputMode="decimal"
                  value={f.loyalty_silver_rate}
                  onChange={(e) => set("loyalty_silver_rate", e.target.value)}
                  className="pr-8 text-right tabular"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                  %
                </span>
              </div>
            </Field>
          </div>
        </SettingRow>
        <SettingRow
          label="골드 단골 기준"
          description="완료한 여행이 이 횟수 이상이면 골드 단골이 됩니다. 할인은 총액(옵션·차량 포함)에 적용되고 원 단위 절사합니다."
          error={errors.loyalty_gold_trips ?? errors.loyalty_gold_rate}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="완료 여행">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={f.loyalty_gold_trips}
                  onChange={(e) => set("loyalty_gold_trips", e.target.value)}
                  className="pr-8 text-right tabular"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                  회
                </span>
              </div>
            </Field>
            <Field label="할인율">
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  inputMode="decimal"
                  value={f.loyalty_gold_rate}
                  onChange={(e) => set("loyalty_gold_rate", e.target.value)}
                  className="pr-8 text-right tabular"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                  %
                </span>
              </div>
            </Field>
          </div>
        </SettingRow>
        <SettingRow
          label="예약금 비율"
          description="예약 시 결제하는 예약금 비율입니다. 총액 × 비율을 천원 단위로 절사해 청구합니다."
          error={errors.deposit_rate}
        >
          <Field>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="decimal"
                value={f.deposit_rate}
                onChange={(e) => set("deposit_rate", e.target.value)}
                className="pr-8 text-right tabular"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted">
                %
              </span>
            </div>
          </Field>
        </SettingRow>
      </Card>
    </>
  );
}
