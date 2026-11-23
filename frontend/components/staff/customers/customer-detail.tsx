"use client";

import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { BookingDrawer } from "@/components/staff/bookings/booking-drawer";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { CardHeader, PageHeader } from "@/components/staff/ui/page-header";
import {
  BookingStatusBadge,
  LoyaltyBadge,
} from "@/components/staff/ui/status-badge";
import { useLoad } from "@/components/staff/use-load";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { dateTime, fullDate, shortDate, STYLE_LABEL, won } from "@/lib/format";
import type { Booking } from "@/lib/types";

export function CustomerDetail({ id }: { id: string }) {
  const load = useCallback(() => api.staff.customers.get(Number(id)), [id]);
  const { data, setData, loading, error } = useLoad(load);
  const [selected, setSelected] = useState<Booking | null>(null);

  const cols: Column<Booking>[] = [
    {
      key: "code",
      header: "예약번호",
      width: "w-[150px]",
      render: (b) => (
        <span className="font-mono text-[13px] font-semibold">{b.code}</span>
      ),
    },
    {
      key: "pkg",
      header: "상품",
      wrap: true,
      render: (b) => (
        <div>
          <p className="line-clamp-1">{b.package.title}</p>
          <p className="text-[12px] text-muted">{b.theme.name}</p>
        </div>
      ),
    },
    {
      key: "depart",
      header: "출발일",
      width: "w-[110px]",
      render: (b) => (
        <span className="tabular">{fullDate(b.departure.depart_date)}</span>
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
      width: "w-[70px]",
      render: (b) => `${b.travelers_count}명`,
    },
    {
      key: "total",
      header: "총액",
      align: "right",
      width: "w-[120px]",
      render: (b) => (
        <span className="font-semibold">{won(b.quote.total)}</span>
      ),
    },
    {
      key: "status",
      header: "상태",
      width: "w-[110px]",
      render: (b) => <BookingStatusBadge status={b.status} />,
    },
    {
      key: "created",
      header: "생성일",
      width: "w-[140px]",
      render: (b) => (
        <span className="tabular text-muted">{dateTime(b.created_at)}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!data) {
    return (
      <Card>
        <EmptyState
          title="고객을 찾을 수 없어요"
          description={error ?? undefined}
          action={
            <Link href="/staff/customers">
              <Button variant="outline" size="sm">
                목록으로
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const { user, bookings } = data;
  const completed = bookings.filter((b) => b.status === "completed");
  const upcoming = bookings.filter(
    (b) =>
      b.status === "confirmed" ||
      b.status === "gathering" ||
      b.status === "pending",
  );
  const totalSpent = bookings
    .filter((b) => b.status === "completed" || b.status === "confirmed")
    .reduce((s, b) => s + b.quote.total, 0);
  const lastTrip = completed
    .map((b) => b.departure.depart_date)
    .sort()
    .at(-1);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {user.name}
            {user.loyalty && <LoyaltyBadge tier={user.loyalty.tier} />}
          </span>
        }
        description={`가입 ${fullDate(user.created_at.slice(0, 10))} · 고객 ID ${user.id}`}
        actions={
          <Link href="/staff/customers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4" />
              고객 목록
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">
            연락 정보
          </h2>
          <dl className="space-y-2 text-[14px]">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted" aria-hidden />
              <dd className="tabular">{user.phone || "-"}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted" aria-hidden />
              <dd className="break-all">{user.email}</dd>
            </div>
            <div className="flex items-start gap-2">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-muted"
                aria-hidden
              />
              <dd>{user.address || "-"}</dd>
            </div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">
            단골 등급
          </h2>
          {user.loyalty ? (
            <dl className="space-y-1.5 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted">현재 등급</dt>
                <dd className="font-semibold">
                  <LoyaltyBadge tier={user.loyalty.tier} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">완료 여행</dt>
                <dd className="tabular font-semibold">
                  {user.loyalty.completed_trips}회
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">적용 할인율</dt>
                <dd className="tabular font-semibold">
                  {Math.round(user.loyalty.rate * 100)}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">다음 등급까지</dt>
                <dd className="tabular">
                  {user.loyalty.next_tier_trips != null
                    ? `${user.loyalty.next_tier_trips - user.loyalty.completed_trips}회 더`
                    : "최고 등급"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-[14px] text-muted">등급 정보가 없어요.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">
            이용 요약
          </h2>
          <dl className="space-y-1.5 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted">전체 예약</dt>
              <dd className="tabular font-semibold">{bookings.length}건</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">진행 중</dt>
              <dd className="tabular font-semibold">{upcoming.length}건</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">누적 결제(확정·완료)</dt>
              <dd className="tabular font-semibold">{won(totalSpent)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">최근 여행</dt>
              <dd className="tabular">
                {lastTrip ? shortDate(lastTrip) : "-"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader
          title="예약 내역"
          description="행을 클릭하면 상세를 볼 수 있어요"
        />
        <DataTable
          columns={cols}
          rows={[...bookings].sort((a, b) =>
            b.created_at.localeCompare(a.created_at),
          )}
          rowKey={(b) => b.id}
          onRowClick={setSelected}
          selectedKey={selected?.id ?? null}
          emptyTitle="예약 내역이 없어요"
        />
      </Card>

      <BookingDrawer
        booking={selected}
        onClose={() => setSelected(null)}
        onUpdated={(b) => {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  bookings: prev.bookings.map((x) => (x.id === b.id ? b : x)),
                }
              : prev,
          );
          setSelected(b);
        }}
      />
    </>
  );
}
