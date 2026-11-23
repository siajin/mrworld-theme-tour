"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import type { PackageCard as PackageCardType } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PackageCard, PackageCardSkeleton } from "./package-card";
import { applyClientFilters, toApiQuery, type PackageFilters } from "./package-filters";

const PAGE = 6;

/** 필터 → api.packages.list → 카드 목록 (더보기 방식) */
export function usePackageResults(filters: PackageFilters) {
  const toast = useToast();
  const [result, setResult] = useState<{ key: string; items: PackageCardType[] } | null>(null);
  const key = JSON.stringify(toApiQuery(filters));

  useEffect(() => {
    let alive = true;
    api.packages
      .list(JSON.parse(key))
      .then((list) => alive && setResult({ key, items: list }))
      .catch((err: unknown) => {
        if (!alive) return;
        toast(err instanceof Error ? err.message : "상품을 불러오지 못했어요", "error");
        setResult({ key, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [key, toast]);

  const items = result && result.key === key ? result.items : null;
  const filtered = useMemo(() => (items ? applyClientFilters(items, filters) : null), [items, filters]);
  return { items: filtered, loading: items === null };
}

export function PackageResults({
  items,
  loading,
  onReset,
  layout = "list",
  emptyTitle = "조건에 맞는 상품이 없어요",
  emptyDescription = "필터를 조금 넓혀 보거나 다른 테마를 둘러보세요.",
  resetLabel = "필터 초기화",
  className,
}: {
  items: PackageCardType[] | null;
  loading: boolean;
  onReset?: () => void;
  layout?: "list" | "grid";
  emptyTitle?: string;
  emptyDescription?: string;
  resetLabel?: string;
  className?: string;
}) {
  // 목록이 바뀌면 자동으로 처음 PAGE 개만 보이도록, "어느 목록에 대한 값인지" 함께 저장한다
  const [shownFor, setShownFor] = useState<{ items: PackageCardType[] | null; n: number } | null>(null);
  const shown = shownFor && shownFor.items === items ? shownFor.n : PAGE;

  const gridCls = layout === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-4";

  if (loading || items === null) {
    return (
      <div className={clsx(gridCls, className)} aria-busy="true" aria-label="상품 불러오는 중">
        {Array.from({ length: 4 }).map((_, i) => (
          <PackageCardSkeleton key={i} layout={layout} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={clsx("rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface", className)}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            onReset && (
              <Button variant="outline" onClick={onReset} aria-label={resetLabel}>
                {resetLabel}
              </Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={gridCls}>
        {items.slice(0, shown).map((p) => (
          <PackageCard key={p.id} pkg={p} layout={layout} />
        ))}
      </div>
      {shown < items.length && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="lg" onClick={() => setShownFor({ items, n: shown + PAGE })} aria-label="상품 더보기">
            더보기 ({items.length - shown}개 남음)
          </Button>
        </div>
      )}
    </div>
  );
}
