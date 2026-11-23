import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

/** 대시보드 지표 타일 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="mt-2 truncate text-[24px] font-bold leading-tight text-ink tabular">
          {value}
        </p>
      )}
      <p className="mt-1 min-h-[18px] text-[12px] text-muted-2">{hint ?? ""}</p>
    </Card>
  );
}
