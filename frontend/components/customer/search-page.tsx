"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { Theme } from "@/lib/types";
import { PackageFilterBar, usePackageFilters } from "./package-filters";
import { PackageResults, usePackageResults } from "./package-results";
import { useListVoiceCommands } from "./voice-handlers";

export function SearchPage() {
  const sp = useSearchParams();
  const { filters, update, reset } = usePackageFilters();
  const { items, loading } = usePackageResults(filters);
  const [themes, setThemes] = useState<Theme[]>([]);

  useEffect(() => {
    api.themes.list().then(setThemes).catch(() => setThemes([]));
  }, []);

  // 음성: "n번째 상품" → 결과 목록 순서 기준
  useListVoiceCommands("search", items);

  const summary = sp.get("summary");
  const said = sp.get("said");
  const activeTheme = themes.find((t) => t.slug === filters.theme) ?? null;
  const themeName = activeTheme?.name;
  // URL 로 ?theme=honeymoon&style=classic 처럼 들어오면 결과가 비는데, 그 이유를 알려 준다
  const styleBlocked = !!activeTheme && filters.style === "classic" && activeTheme.min_style_rank > 1;

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1120px] px-4 pb-4 pt-6">
          <p className="text-[12px] font-bold tracking-wide text-primary">검색 결과</p>
          <h1 className="mt-1 text-[22px] font-bold text-ink md:text-[26px]">
            {filters.q ? `“${filters.q}”` : themeName ?? "전체 패키지"}
            {filters.region && <span className="text-muted"> · {filters.region}</span>}
          </h1>
          {summary && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden />
              {summary}으로 검색했어요
              {said && <span className="font-normal text-primary/70">· “{said}”</span>}
            </p>
          )}
        </div>
      </div>

      <PackageFilterBar filters={filters} onChange={update} onReset={reset} themes={themes} total={items?.length ?? null} />

      <div className="mx-auto max-w-[1120px] px-4 py-6">
        <PackageResults
          items={items}
          loading={loading}
          onReset={styleBlocked ? () => update({ style: "" }) : reset}
          layout="list"
          resetLabel={styleBlocked ? "스타일 전체로 보기" : undefined}
          emptyTitle={styleBlocked ? `${themeName}는 클래식 스타일이 없어요` : undefined}
          emptyDescription={styleBlocked ? "이 테마는 그랜드 스타일 이상만 판매해요. 스타일 필터를 전체로 바꾸면 상품을 볼 수 있어요." : undefined}
        />
      </div>
    </>
  );
}
