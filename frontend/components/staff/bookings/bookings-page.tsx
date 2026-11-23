"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { PageHeader } from "@/components/staff/ui/page-header";
import { BookingStatusBadge } from "@/components/staff/ui/status-badge";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import {
  BOOKING_STATUS,
  dateTime,
  fullDate,
  shortDate,
  STYLE_LABEL,
  won,
} from "@/lib/format";
import type { Booking, BookingStatus } from "@/lib/types";
import { BookingDrawer } from "./booking-drawer";

type TabKey = "all" | BookingStatus;
const TAB_ORDER: TabKey[] = [
  "all",
  "pending",
  "gathering",
  "confirmed",
  "completed",
  "cancelled",
];

export function BookingsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const departureId = params.get("departure_id");
  const packageId = params.get("package_id");
  const bookingIdParam = params.get("booking_id");

  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(
    bookingIdParam ? Number(bookingIdParam) : null,
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(
    () =>
      api.staff.bookings.list({
        departure_id: departureId ? Number(departureId) : undefined,
        package_id: packageId ? Number(packageId) : undefined,
        q: debounced || undefined,
      }),
    [departureId, packageId, debounced],
  );
  const { data, setData, loading } = useLoad(load);

  // ?booking_id= 로 진입하면 해당 예약 드로어가 바로 열린다
  const selected = useMemo(
    () => (data ?? []).find((b) => b.id === selectedId) ?? null,
    [data, selectedId],
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      all: 0,
      pending: 0,
      gathering: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    (data ?? []).forEach((b) => {
      c.all += 1;
      c[b.status] += 1;
    });
    return c;
  }, [data]);

  const rows = useMemo(
    () => (data ?? []).filter((b) => tab === "all" || b.status === tab),
    [data, tab],
  );
  const scoped = departureId || packageId;
  const scopeLabel = useMemo(() => {
    const first = data?.[0];
    if (!first) return null;
    if (departureId)
      return `${first.package.title} · ${shortDate(first.departure.depart_date)} 출발`;
    if (packageId) return first.package.title;
    return null;
  }, [data, departureId, packageId]);

  const onUpdated = (b: Booking) => {
    setData((prev) => (prev ?? []).map((x) => (x.id === b.id ? b : x)));
    setSelectedId(b.id);
  };

  const cols: Column<Booking>[] = [
    {
      key: "code",
      header: "예약번호",
      width: "w-[135px]",
      render: (b) => (
        <span className="font-mono text-[13px] font-semibold">{b.code}</span>
      ),
    },
    {
      key: "customer",
      header: "고객",
      width: "w-[120px]",
      render: (b) => (
        <div>
          <p className="font-semibold">{b.customer.name}</p>
          <p className="text-[12px] text-muted">{b.customer.phone}</p>
        </div>
      ),
    },
    {
      key: "pkg",
      header: "상품",
      wrap: true,
      render: (b) => (
        <div className="min-w-[180px]">
          <p className="line-clamp-1">{b.package.title}</p>
          <p className="text-[12px] text-muted">{b.theme.name}</p>
        </div>
      ),
    },
    {
      key: "depart",
      header: "출발일",
      width: "w-[100px]",
      render: (b) => (
        <span className="tabular">{shortDate(b.departure.depart_date)}</span>
      ),
    },
    {
      key: "style",
      header: "스타일",
      width: "w-[70px]",
      render: (b) => STYLE_LABEL[b.style_code],
    },
    {
      key: "n",
      header: "인원",
      align: "right",
      width: "w-[70px]",
      render: (b) => (
        <span
          className={
            b.status === "gathering" ? "font-semibold text-primary" : ""
          }
        >
          {b.travelers_count}/{b.theme.min_travelers}명
        </span>
      ),
    },
    {
      key: "total",
      header: "총액",
      align: "right",
      width: "w-[110px]",
      render: (b) => (
        <span className="font-semibold">{won(b.quote.total)}</span>
      ),
    },
    {
      key: "status",
      header: "상태",
      width: "w-[100px]",
      render: (b) => <BookingStatusBadge status={b.status} />,
    },
    {
      key: "created",
      header: "생성일",
      width: "w-[100px]",
      render: (b) => (
        <span className="tabular text-muted" title={dateTime(b.created_at)}>
          {fullDate(b.created_at.slice(0, 10))}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="예약 관리"
        description={
          scoped && scopeLabel ? (
            <span className="inline-flex items-center gap-2">
              <Badge tone="info">
                {departureId ? "출발일정 필터" : "상품 필터"}
              </Badge>
              {scopeLabel}
              <button
                type="button"
                onClick={() => router.push(pathname)}
                className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-primary hover:underline"
              >
                <X className="size-3.5" /> 필터 해제
              </button>
            </span>
          ) : (
            "예약을 클릭하면 여행자·옵션·금액을 확인하고 상태를 바꿀 수 있어요."
          )
        }
      />

      <Card className="overflow-hidden">
        <Tabs<TabKey>
          items={TAB_ORDER.map((k) => ({
            value: k,
            label: k === "all" ? "전체" : BOOKING_STATUS[k].label,
            count: counts[k],
          }))}
          value={tab}
          onChange={setTab}
          className="px-2"
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative w-[320px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="예약번호 · 고객명 · 연락처 · 상품명"
              className="h-10 pl-9"
              aria-label="예약 검색"
            />
          </div>
          {q && (
            <Button variant="ghost" size="sm" onClick={() => setQ("")}>
              지우기
            </Button>
          )}
          <span className="ml-auto text-[13px] text-muted tabular">
            {rows.length}건
          </span>
        </div>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(b) => b.id}
          loading={loading}
          onRowClick={(b) => setSelectedId(b.id)}
          selectedKey={selectedId}
          maxHeight="max-h-[calc(100dvh-320px)]"
          emptyTitle="조건에 맞는 예약이 없어요"
          emptyDescription={debounced ? "검색어를 바꿔 보세요." : undefined}
        />
      </Card>

      <BookingDrawer
        booking={selected}
        onClose={() => setSelectedId(null)}
        onUpdated={onUpdated}
      />
    </>
  );
}
