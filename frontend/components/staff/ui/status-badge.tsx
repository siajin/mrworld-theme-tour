import { Badge, type BadgeTone } from "@/components/ui/badge";
import { BOOKING_STATUS, DEPARTURE_STATUS, LOYALTY_LABEL } from "@/lib/format";
import type {
  BookingStatus,
  DepartureStatus,
  InventoryMove,
  LoyaltyTier,
} from "@/lib/types";

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const DEP_TONE: Record<DepartureStatus, BadgeTone> = {
  open: "info",
  closed: "warning",
  departed: "muted",
};
export function DepartureStatusBadge({ status }: { status: DepartureStatus }) {
  return <Badge tone={DEP_TONE[status]}>{DEPARTURE_STATUS[status]}</Badge>;
}

const MOVE_META: Record<
  InventoryMove["type"],
  { label: string; tone: BadgeTone }
> = {
  in: { label: "입고", tone: "success" },
  out: { label: "출고", tone: "danger" },
  adjust: { label: "조정", tone: "neutral" },
};
export function MoveTypeBadge({ type }: { type: InventoryMove["type"] }) {
  const m = MOVE_META[type];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
export const MOVE_LABEL: Record<InventoryMove["type"], string> = {
  in: "입고",
  out: "출고",
  adjust: "조정",
};

const LOYALTY_TONE: Record<LoyaltyTier, BadgeTone> = {
  basic: "muted",
  silver: "neutral",
  gold: "accent",
};
export function LoyaltyBadge({ tier }: { tier: LoyaltyTier }) {
  return <Badge tone={LOYALTY_TONE[tier]}>{LOYALTY_LABEL[tier]}</Badge>;
}

export function PublishedBadge({ published }: { published: boolean }) {
  return (
    <Badge tone={published ? "success" : "muted"}>
      {published ? "노출 중" : "비노출"}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "muted"}>
      {active ? "활성" : "비활성"}
    </Badge>
  );
}
