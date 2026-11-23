import Link from "next/link";
import { clsx } from "clsx";
import { Star } from "lucide-react";
import type { PackageCard as PackageCardType } from "@/lib/types";
import { STYLE_LABEL, duration, shortDate, won } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Photo } from "@/components/ui/misc";
import { ratingText } from "./utils";

function badgeTone(label: string): BadgeTone {
  if (label.includes("확정")) return "success";
  if (label.includes("임박") || label.includes("마감")) return "accent";
  if (label.includes("신규")) return "info";
  return "neutral";
}

/** 여기어때 리스트 카드 + Wanderly 사진 카드 구조를 합친 패키지 카드 */
export function PackageCard({
  pkg,
  layout = "grid",
  className,
}: {
  pkg: PackageCardType;
  /** grid = 세로형 카드, list = 사진 왼쪽/정보 오른쪽 */
  layout?: "grid" | "list";
  className?: string;
}) {
  const next = pkg.next_departure;
  const lowSeats = next != null && next.remaining > 0 && next.remaining <= 3;
  const badges = pkg.badges.slice(0, 2);

  return (
    <Link
      href={`/packages/${pkg.id}`}
      aria-label={`${pkg.title} 상세 보기`}
      className={clsx(
        "group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]",
        layout === "list" && "sm:flex",
        className,
      )}
    >
      <div className={clsx("relative", layout === "list" ? "sm:w-[280px] sm:shrink-0" : "")}>
        <Photo
          src={pkg.hero_images[0]}
          alt={pkg.title}
          className={clsx("aspect-[4/3] w-full", layout === "list" && "sm:h-full sm:aspect-auto sm:min-h-[200px]")}
          imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {badges.length > 0 && (
          <div className="absolute left-3 top-3 flex gap-1.5">
            {badges.map((b) => (
              <Badge key={b} tone={badgeTone(b)} className="shadow-[var(--shadow-card)]">
                {b}
              </Badge>
            ))}
          </div>
        )}
        <span className="absolute bottom-3 right-3 rounded-md bg-ink/70 px-2 py-0.5 text-[12px] font-semibold text-white tabular">
          {duration(pkg.nights, pkg.days)}
        </span>
      </div>

      <div className={clsx("p-4", layout === "list" && "sm:flex sm:flex-1 sm:flex-col sm:p-5")}>
        <p className="truncate text-[13px] text-muted">
          {pkg.theme.name.replace(/ 투어$/, "")} · {pkg.region}, {pkg.country} · 인천 출발
        </p>
        <h3 className="mt-1 line-clamp-2 text-[16px] font-bold leading-snug text-ink">{pkg.title}</h3>
        {layout === "list" && <p className="mt-1 hidden line-clamp-1 text-[14px] text-ink-2 sm:block">{pkg.subtitle}</p>}

        <p className="mt-2 flex items-center gap-1 text-[13px] text-ink-2">
          <Star className="size-[14px] fill-[#f5b301] text-[#f5b301]" aria-hidden />
          <span className="tabular font-semibold">{ratingText(pkg.rating, pkg.review_count)}</span>
        </p>

        <div className={clsx("mt-3 flex items-end justify-between gap-3", layout === "list" && "sm:mt-auto sm:pt-3")}>
          <div className="min-w-0 text-[12px] text-muted">
            {next ? (
              <>
                <span className="tabular">{shortDate(next.depart_date)} 출발</span>
                <span aria-hidden> · </span>
                <span className={clsx("tabular", lowSeats && "font-semibold text-accent")}>
                  {next.remaining > 0 ? `잔여 ${next.remaining}명` : "마감"}
                </span>
              </>
            ) : (
              <span>출발일 문의</span>
            )}
            <p className="mt-0.5">예약금만 결제 가능</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[12px] text-muted">성인 1인</p>
            <p className="whitespace-nowrap text-[18px] font-bold leading-tight text-accent tabular">{won(pkg.from_price)}~</p>
            <p className="text-[11px] text-muted-2">{STYLE_LABEL[pkg.from_style]} 기준</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PackageCardSkeleton({ layout = "grid" }: { layout?: "grid" | "list" }) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface",
        layout === "list" && "sm:flex",
      )}
    >
      <div
        className={clsx(
          "aspect-[4/3] animate-pulse bg-line",
          layout === "list" && "sm:aspect-auto sm:w-[280px] sm:shrink-0 sm:min-h-[200px]",
        )}
      />
      <div className="flex-1 space-y-2.5 p-4">
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-line" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-line" />
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-line" />
        <div className="flex justify-between pt-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-line" />
          <div className="h-6 w-1/4 animate-pulse rounded bg-line" />
        </div>
      </div>
    </div>
  );
}
