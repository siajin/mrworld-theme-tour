import { clsx } from "clsx";

export type BadgeTone = "neutral" | "info" | "success" | "danger" | "warning" | "muted" | "accent";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-bg text-ink-2 border border-line",
  info: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  muted: "bg-bg text-muted",
  accent: "bg-[#fff4ec] text-accent",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold leading-5 whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
