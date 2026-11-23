"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Theme } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { ThemeCard, ThemeCardSkeleton } from "./theme-card";

export function ThemesPage() {
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[] | null>(null);

  useEffect(() => {
    api.themes
      .list()
      .then(setThemes)
      .catch((err: unknown) => {
        toast(err instanceof Error ? err.message : "테마를 불러오지 못했어요", "error");
        setThemes([]);
      });
  }, [toast]);

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 md:py-12">
      <p className="text-[12px] font-bold tracking-wide text-primary">Themes</p>
      <h1 className="mt-1 text-[26px] font-bold text-ink md:text-[32px]">테마별 맞춤 여행</h1>
      <p className="mt-2 max-w-[560px] text-[15px] text-muted">
        여행의 목적에 맞춰 차량·숙소·식사·기념품을 미리 구성해 두었습니다. 테마를 고르면 그 테마에 맞는 패키지만
        보여 드려요.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {themes === null
          ? Array.from({ length: 4 }).map((_, i) => <ThemeCardSkeleton key={i} />)
          : themes.map((t) => <ThemeCard key={t.id} theme={t} />)}
      </div>
    </div>
  );
}
