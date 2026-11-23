import { Car, Gift } from "lucide-react";
import type { ThemePerk } from "@/lib/types";

export function ThemeBenefits({ perks, transportLabel, travelersCount }: {
  perks: ThemePerk[];
  transportLabel: string;
  travelersCount?: number;
}) {
  return (
    <div aria-label="테마 기본 제공" className="rounded-[var(--radius-card)] bg-primary-soft p-4">
      <h2 className="text-[14px] font-bold text-primary">테마 기본 제공</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        <li className="flex items-start gap-2 text-[14px] text-ink">
          <Car className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{transportLabel} <span className="text-[12px] text-muted">전 일정 · 선택 차량</span></span>
        </li>
        {perks.map((perk) => {
          const total = perk.qty_per_booking * (perk.per_person ? travelersCount ?? 1 : 1);
          return (
            <li key={perk.id} className="flex items-start gap-2 text-[14px] text-ink">
              <Gift className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 break-words">
                {perk.label}
                <span className="mt-0.5 block text-[12px] text-muted">
                  {perk.per_person ? "1인당" : "예약당"} {perk.qty_per_booking}{perk.unit}
                  {travelersCount !== undefined && ` · 총 ${total}${perk.unit}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
