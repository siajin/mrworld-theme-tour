"use client";

import { useEffect, useState } from "react";
import { Car, Gift, Users } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Theme } from "@/lib/types";
import { STYLE_LABEL, won } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Photo, Skeleton } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { ThemeIcon } from "./theme-icon";
import { PackageFilterBar, usePackageFilters } from "./package-filters";
import { PackageResults, usePackageResults } from "./package-results";
import { NotFoundBlock } from "./not-found-block";
import { useListVoiceCommands } from "./voice-handlers";

export function ThemeDetailPage({ slug }: { slug: string }) {
  const toast = useToast();
  const [theme, setTheme] = useState<Theme | null | undefined>(undefined);
  const { filters, update, reset } = usePackageFilters();
  const effective = { ...filters, theme: slug };
  const { items, loading } = usePackageResults(effective);
  useListVoiceCommands("theme", items);

  useEffect(() => {
    let alive = true;
    api.themes
      .get(slug)
      .then((t) => alive && setTheme(t))
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) setTheme(null);
        else {
          toast(err instanceof Error ? err.message : "테마를 불러오지 못했어요", "error");
          setTheme(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [slug, toast]);

  if (theme === null) {
    return <NotFoundBlock title="테마를 찾을 수 없어요" description="주소가 바뀌었거나 운영이 종료된 테마예요." />;
  }

  const minStyle = theme ? (theme.min_style_rank === 3 ? "premium" : theme.min_style_rank === 2 ? "grand" : "classic") : null;
  const styleBlocked = !!theme && filters.style === "classic" && theme.min_style_rank > 1;

  const perks = theme
    ? [
        {
          icon: Car,
          title: theme.vehicle_label,
          desc: "전 일정 전용 차량 이동",
        },
        {
          icon: Gift,
          title: theme.perks.map((p) => p.label).join(" · ") || "테마 기념품",
          desc: "여행 요금에 포함된 기본 제공",
        },
        {
          icon: Users,
          title: `최소 ${theme.min_travelers}명 출발 확정`,
          desc:
            minStyle && minStyle !== "classic"
              ? `${STYLE_LABEL[minStyle]} 스타일 이상으로 운영`
              : "클래식부터 프리미엄까지 선택",
        },
      ]
    : [];

  return (
    <>
      {/* ── 테마 히어로 ─────────────────────────────────────── */}
      <section className="bg-surface">
        <div className="mx-auto max-w-[1120px] px-4 pt-6 md:pt-8">
          {theme === undefined ? (
            <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-72" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
              <Skeleton className="aspect-[16/9] w-full rounded-[20px]" />
            </div>
          ) : (
            <div className="grid items-center gap-6 md:grid-cols-[1fr_1.1fr]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <ThemeIcon name={theme.icon} className="size-[18px]" aria-hidden />
                  </span>
                  <Badge tone="info">{theme.package_count ?? 0}개 상품</Badge>
                  {theme.from_price != null && (
                    <span className="text-[13px] text-muted">
                      1인 <b className="tabular text-accent">{won(theme.from_price)}</b>~
                    </span>
                  )}
                </div>
                <h1 className="mt-3 text-[28px] font-bold leading-tight text-primary-dark md:text-[36px]">{theme.name}</h1>
                <p className="mt-2 text-[17px] font-semibold text-primary">{theme.tagline}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{theme.description}</p>
              </div>
              <Photo src={theme.hero_image} alt={theme.name} className="aspect-[16/9] w-full rounded-[20px]" />
            </div>
          )}

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {theme
              ? perks.map((p) => (
                  <li key={p.title} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-bg p-4">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-primary shadow-[var(--shadow-card)]">
                      <p.icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-[14.5px] font-bold text-ink">{p.title}</p>
                      <p className="text-[13px] text-muted">{p.desc}</p>
                    </div>
                  </li>
                ))
              : Array.from({ length: 3 }).map((_, i) => (
                  <li key={i}>
                    <Skeleton className="h-[74px] w-full rounded-[var(--radius-card)]" />
                  </li>
                ))}
          </ul>
          <div className="h-6" />
        </div>
      </section>

      <PackageFilterBar
        filters={effective}
        onChange={update}
        onReset={reset}
        fixedTheme={theme ?? null}
        total={items?.length ?? null}
      />

      <div className="mx-auto max-w-[1120px] px-4 py-6">
        <PackageResults
          items={items}
          loading={loading}
          onReset={styleBlocked ? () => update({ style: "" }) : reset}
          layout="list"
          resetLabel={styleBlocked ? "스타일 전체로 보기" : undefined}
          emptyTitle={styleBlocked && theme ? `${theme.name}는 클래식 스타일이 없어요` : undefined}
          emptyDescription={
            styleBlocked && minStyle ? `이 테마는 ${STYLE_LABEL[minStyle]} 스타일 이상만 판매해요. 스타일 필터를 전체로 바꾸면 상품을 볼 수 있어요.` : undefined
          }
        />
      </div>
    </>
  );
}
