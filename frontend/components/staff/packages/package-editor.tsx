"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useLoad } from "@/components/staff/use-load";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import Link from "next/link";
import { PackageForm, type TabKey } from "./package-form";

const TABS: TabKey[] = [
  "basic",
  "prices",
  "itinerary",
  "includes",
  "departures",
  "publish",
];

/** 기존 상품 로드 후 폼 렌더. ?tab= 으로 시작 탭 지정. */
export function PackageEditor({ id }: { id: string }) {
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const initialTab = TABS.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : "basic";

  const load = useCallback(() => api.staff.packages.get(id), [id]);
  const { data, loading, error } = useLoad(load);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[480px]" />
      </div>
    );
  }
  if (!data) {
    return (
      <Card>
        <EmptyState
          title="상품을 찾을 수 없어요"
          description={error ?? undefined}
          action={
            <Link href="/staff/packages">
              <Button variant="outline" size="sm">
                목록으로
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }
  return <PackageForm pkg={data} initialTab={initialTab} />;
}
