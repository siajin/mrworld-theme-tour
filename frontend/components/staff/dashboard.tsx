"use client";

import {
  ArrowRight,
  CalendarCheck,
  CircleDollarSign,
  PackagePlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { MoveModal } from "@/components/staff/inventory/move-modal";
import { PageHeader, CardHeader } from "@/components/staff/ui/page-header";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { StatTile } from "@/components/staff/ui/stat-tile";
import {
  BookingStatusBadge,
  DepartureStatusBadge,
} from "@/components/staff/ui/status-badge";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { dateTime, shortDate, STYLE_LABEL, won } from "@/lib/format";
import type { Booking, InventoryItem, StaffDashboard } from "@/lib/types";

type Upcoming = StaffDashboard["upcoming_departures"][number];

export function Dashboard() {
  const load = useCallback(() => api.staff.dashboard(), []);
  const { data, loading, reload } = useLoad(load);
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null);

  const upcomingCols: Column<Upcoming>[] = [
    {
      key: "date",
      header: "출발일",
      width: "w-[110px]",
      render: (r) => (
        <span className="font-semibold tabular">
          {shortDate(r.departure.depart_date)}
        </span>
      ),
    },
    {
      key: "pkg",
      header: "상품",
      wrap: true,
      render: (r) => (
        <div className="min-w-[180px]">
          <p className="line-clamp-1 font-medium">{r.package_title}</p>
          <p className="text-[12px] text-muted">{r.theme_name}</p>
        </div>
      ),
    },
    {
      key: "bookings",
      header: "예약",
      align: "right",
      width: "w-[60px]",
      render: (r) => r.bookings,
    },
    {
      key: "seats",
      header: "인원/정원",
      align: "right",
      width: "w-[90px]",
      render: (r) => (
        <span>
          {r.departure.booked}/{r.departure.capacity}
        </span>
      ),
    },
    {
      key: "remaining",
      header: "잔여",
      align: "right",
      width: "w-[80px]",
      render: (r) =>
        r.departure.remaining <= 3 ? (
          <Badge tone="warning">{r.departure.remaining}석</Badge>
        ) : (
          <span>{r.departure.remaining}석</span>
        ),
    },
    {
      key: "status",
      header: "상태",
      width: "w-[90px]",
      render: (r) => <DepartureStatusBadge status={r.departure.status} />,
    },
    {
      key: "go",
      header: "",
      align: "right",
      width: "w-[60px]",
      render: (r) => (
        <Link
          href={`/staff/bookings?departure_id=${r.departure.id}`}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-primary-soft hover:text-primary"
          aria-label="예약 보기"
        >
          <ArrowRight className="size-4" />
        </Link>
      ),
    },
  ];

  const bookingCols: Column<Booking>[] = [
    {
      key: "code",
      header: "예약번호",
      width: "w-[150px]",
      render: (b) => <span className="font-mono text-[13px]">{b.code}</span>,
    },
    {
      key: "customer",
      header: "고객",
      width: "w-[110px]",
      render: (b) => b.customer.name,
    },
    {
      key: "pkg",
      header: "상품",
      wrap: true,
      render: (b) => <span className="line-clamp-1">{b.package.title}</span>,
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
      width: "w-[80px]",
      render: (b) => STYLE_LABEL[b.style_code],
    },
    {
      key: "n",
      header: "인원",
      align: "right",
      width: "w-[60px]",
      render: (b) => `${b.travelers_count}명`,
    },
    {
      key: "total",
      header: "총액",
      align: "right",
      width: "w-[120px]",
      render: (b) => won(b.quote.total),
    },
    {
      key: "status",
      header: "상태",
      width: "w-[110px]",
      render: (b) => <BookingStatusBadge status={b.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="대시보드"
        description="오늘의 예약 현황과 확정 임박 일정, 재고 부족 물품을 한눈에 확인합니다."
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            새로 고침
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="오늘 신규 예약"
          value={`${data?.today_bookings ?? 0}건`}
          icon={PackagePlus}
          loading={loading}
        />
        <StatTile
          label="동행 모집 중"
          value={`${data?.gathering_bookings ?? 0}건`}
          hint="최소 인원 미달 예약"
          icon={Users}
          loading={loading}
        />
        <StatTile
          label="이번 주 확정"
          value={`${data?.confirmed_this_week ?? 0}건`}
          icon={CalendarCheck}
          loading={loading}
        />
        <StatTile
          label="이번 달 매출"
          value={won(data?.revenue_this_month ?? 0)}
          hint="확정·완료 예약 총액"
          icon={CircleDollarSign}
          loading={loading}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="확정 임박 출발일정"
            description="잔여 좌석이 적거나 출발이 가까운 일정"
            actions={
              <Link
                href="/staff/departures"
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                전체 보기
              </Link>
            }
          />
          <DataTable
            columns={upcomingCols}
            rows={data?.upcoming_departures ?? []}
            rowKey={(r) => r.departure.id}
            loading={loading}
            skeletonRows={5}
            emptyTitle="임박한 출발일정이 없어요"
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="재고 부족 물품"
            description="안전재고 이하로 떨어진 물품"
            actions={
              <Link
                href="/staff/inventory"
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                창고 보기
              </Link>
            }
          />
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !data || data.low_stock_items.length === 0 ? (
            <EmptyState
              title="재고 부족 물품이 없어요"
              description="모든 물품이 안전재고 이상입니다."
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.low_stock_items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {it.name}
                    </p>
                    <p className="text-[12px] text-muted">
                      <span className="font-mono">{it.sku}</span> ·{" "}
                      {it.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-[13px] tabular">
                      <span className="font-bold text-danger">
                        {it.stock_qty}
                        {it.unit}
                      </span>
                      <span className="text-muted-2">
                        {" "}
                        / 안전 {it.reorder_level}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setMoveItem(it)}
                    >
                      입고
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader
            title="최근 예약"
            actions={
              <Link
                href="/staff/bookings"
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                전체 보기
              </Link>
            }
          />
          <DataTable
            columns={bookingCols}
            rows={data?.recent_bookings ?? []}
            rowKey={(b) => b.id}
            loading={loading}
            skeletonRows={6}
            emptyTitle="최근 예약이 없어요"
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="최근 알림"
            description="문자 발송 기록 (1단계: 기록만)"
            actions={
              <Link
                href="/staff/notifications"
                className="text-[13px] font-semibold text-primary hover:underline"
              >
                로그 보기
              </Link>
            }
          />
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : !data || data.recent_notifications.length === 0 ? (
            <EmptyState title="최근 알림이 없어요" />
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {data.recent_notifications.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {n.title}
                    </p>
                    <span className="flex shrink-0 items-center gap-1">
                      {n.status === "failed" && <Badge tone="danger">실패</Badge>}
                      <Badge tone="info">문자</Badge>
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-2">
                    {n.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-2">
                    {n.user_name} · {dateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <MoveModal
        item={moveItem}
        initialType="in"
        onClose={() => setMoveItem(null)}
        onDone={() => reload()}
      />
    </>
  );
}
