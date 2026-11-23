"use client";

import { useState } from "react";
import { addDays, errMsg } from "@/components/staff/lib";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { DEPARTURE_STATUS } from "@/lib/format";
import type { Departure, DepartureStatus } from "@/lib/types";

export interface DepartureModalState {
  packageId: number;
  /** 여행 일수 (귀국일 자동 계산: 출발일 + days - 1) */
  days: number;
  departure?: Departure;
}

interface Props {
  state: DepartureModalState | null;
  onClose: () => void;
  onSaved: (d: Departure, mode: "create" | "update") => void;
}

export function DepartureModal({ state, onClose, onSaved }: Props) {
  if (!state) return null;
  return (
    <DepartureModalInner
      key={state.departure?.id ?? "new"}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function DepartureModalInner({
  state,
  onClose,
  onSaved,
}: Props & { state: DepartureModalState }) {
  const toast = useToast();
  const init = state.departure;
  const [depart, setDepart] = useState(init?.depart_date ?? "");
  const [ret, setRet] = useState(init?.return_date ?? "");
  const [retTouched, setRetTouched] = useState(!!init);
  const [capacity, setCapacity] = useState(String(init?.capacity ?? 12));
  const [status, setStatus] = useState<DepartureStatus>(init?.status ?? "open");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onDepartChange = (v: string) => {
    setDepart(v);
    if (!retTouched) setRet(addDays(v, Math.max(0, state.days - 1)));
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!depart) errs.depart = "출발일을 선택해 주세요";
    if (!ret) errs.ret = "귀국일을 선택해 주세요";
    else if (depart && ret < depart) errs.ret = "귀국일은 출발일 이후여야 해요";
    const cap = Number(capacity);
    if (!capacity || !Number.isInteger(cap) || cap < 1)
      errs.capacity = "정원은 1명 이상이어야 해요";
    else if (state.departure && cap < state.departure.booked)
      errs.capacity = `이미 예약된 ${state.departure.booked}명보다 적게 줄일 수 없어요`;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const body = {
        depart_date: depart,
        return_date: ret,
        capacity: cap,
        status,
      };
      if (state.departure) {
        const d = await api.staff.packages.updateDeparture(
          state.packageId,
          state.departure.id,
          body,
        );
        toast("출발일정을 수정했어요", "success");
        onSaved(d, "update");
      } else {
        const d = await api.staff.packages.addDeparture(state.packageId, body);
        toast("출발일정을 추가했어요", "success");
        onSaved(d, "create");
      }
      onClose();
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={state.departure ? "출발일정 수정" : "출발일정 추가"}
      size="sm"
      sheetOnMobile={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button size="sm" onClick={submit} loading={busy}>
            저장
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="출발일" required error={errors.depart}>
          <Input
            type="date"
            value={depart}
            onChange={(e) => onDepartChange(e.target.value)}
          />
        </Field>
        <Field
          label="귀국일"
          required
          error={errors.ret}
          hint={!retTouched ? "출발일 기준 자동 계산" : undefined}
        >
          <Input
            type="date"
            value={ret}
            min={depart || undefined}
            onChange={(e) => {
              setRetTouched(true);
              setRet(e.target.value);
            }}
          />
        </Field>
        <Field
          label="정원"
          required
          error={errors.capacity}
          hint={
            state.departure
              ? `현재 예약 ${state.departure.booked}명`
              : undefined
          }
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field label="상태">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as DepartureStatus)}
          >
            {(Object.keys(DEPARTURE_STATUS) as DepartureStatus[]).map((s) => (
              <option key={s} value={s}>
                {DEPARTURE_STATUS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
