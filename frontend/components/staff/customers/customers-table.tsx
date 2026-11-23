"use client";

import { ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { PageHeader } from "@/components/staff/ui/page-header";
import { LoyaltyBadge } from "@/components/staff/ui/status-badge";
import { useLoad } from "@/components/staff/use-load";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { api } from "@/lib/api";
import { fullDate } from "@/lib/format";
import type { StaffCustomer } from "@/lib/types";

export function CustomersTable() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(
    () => api.staff.customers.list(debounced || undefined),
    [debounced],
  );
  const { data, loading } = useLoad(load);

  const cols: Column<StaffCustomer>[] = [
    {
      key: "name",
      header: "이름",
      width: "w-[120px]",
      render: (c) => <span className="font-semibold">{c.name}</span>,
    },
    {
      key: "email",
      header: "이메일",
      render: (c) => <span className="text-ink-2">{c.email}</span>,
    },
    {
      key: "phone",
      header: "연락처",
      width: "w-[140px]",
      render: (c) => <span className="tabular">{c.phone || "-"}</span>,
    },
    {
      key: "addr",
      header: "주소",
      wrap: true,
      render: (c) => (
        <span className="line-clamp-1 text-ink-2">{c.address || "-"}</span>
      ),
    },
    {
      key: "tier",
      header: "단골 등급",
      width: "w-[110px]",
      render: (c) => (c.loyalty ? <LoyaltyBadge tier={c.loyalty.tier} /> : "-"),
    },
    {
      key: "trips",
      header: "완료 여행",
      align: "right",
      width: "w-[90px]",
      render: (c) => `${c.loyalty?.completed_trips ?? 0}회`,
    },
    {
      key: "bookings",
      header: "예약 수",
      align: "right",
      width: "w-[80px]",
      render: (c) => `${c.bookings_count}건`,
    },
    {
      key: "last",
      header: "최근 여행",
      width: "w-[120px]",
      render: (c) => (
        <span className="tabular text-ink-2">
          {c.last_trip ? fullDate(c.last_trip) : "-"}
        </span>
      ),
    },
    {
      key: "go",
      header: "",
      width: "w-[40px]",
      render: () => <ChevronRight className="size-4 text-muted-2" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="고객 관리"
        description={`회원 ${data?.length ?? 0}명 · 이름/이메일/연락처로 검색할 수 있어요.`}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative w-[300px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 · 이메일 · 연락처"
              className="h-10 pl-9"
              aria-label="고객 검색"
            />
          </div>
        </div>
        <DataTable
          columns={cols}
          rows={data ?? []}
          rowKey={(c) => c.id}
          loading={loading}
          onRowClick={(c) => router.push(`/staff/customers/${c.id}`)}
          maxHeight="max-h-[calc(100dvh-260px)]"
          emptyTitle="검색 결과가 없어요"
        />
      </Card>
    </>
  );
}
