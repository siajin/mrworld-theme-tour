import Link from "next/link";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import type { Theme } from "@/lib/types";
import { won } from "@/lib/format";
import { Photo } from "@/components/ui/misc";
import { ThemeIcon } from "./theme-icon";

/** 홈 "테마별 맞춤 여행" 카드: 사진 + 이름 + 한줄 설명 + from 가격 */
export function ThemeCard({ theme, className }: { theme: Theme; className?: string }) {
  return (
    <Link
      href={`/themes/${theme.slug}`}
      aria-label={`${theme.name} 패키지 보기`}
      className={clsx(
        "group relative block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <Photo
        src={theme.hero_image}
        alt={theme.name}
        className="aspect-[5/4] w-full"
        imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <ThemeIcon name={theme.icon} className="size-4" aria-hidden />
          </span>
          <h3 className="text-[16px] font-bold text-ink">{theme.name}</h3>
        </div>
        <p className="mt-2 line-clamp-2 min-h-[42px] text-[13.5px] leading-snug text-muted">{theme.tagline}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[12px] text-muted">
              {theme.package_count ?? 0}개 상품 · 최소 {theme.min_travelers}명 출발
            </p>
            {theme.from_price != null && (
              <p className="text-[15px] font-bold text-accent tabular">
                <span className="mr-1 text-[12px] font-semibold text-muted">1인</span>
                {won(theme.from_price)}~
              </p>
            )}
          </div>
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-bg text-ink-2 transition-colors group-hover:bg-primary group-hover:text-white">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ThemeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="aspect-[5/4] animate-pulse bg-line" />
      <div className="space-y-2.5 p-4">
        <div className="h-5 w-2/3 animate-pulse rounded bg-line" />
        <div className="h-3.5 w-full animate-pulse rounded bg-line" />
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-line" />
      </div>
    </div>
  );
}
