import Link from "next/link";
import { Plane } from "lucide-react";
import { clsx } from "clsx";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <Link href="/" aria-label="미스터 월드 홈으로" className={clsx("inline-flex items-center gap-2", className)}>
      <span
        className={clsx(
          "inline-flex items-center justify-center rounded-[9px] bg-primary text-white",
          size === "sm" ? "size-7" : "size-8",
        )}
      >
        <Plane className={size === "sm" ? "size-4" : "size-[18px]"} aria-hidden />
      </span>
      <span className={clsx("font-bold tracking-tight text-ink", size === "sm" ? "text-[16px]" : "text-[18px]")}>
        미스터 월드
      </span>
    </Link>
  );
}
