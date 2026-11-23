"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { errMsg, monthLabel } from "@/components/staff/lib";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { PageHeader } from "@/components/staff/ui/page-header";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { DEPARTURE_STATUS, shortDate } from "@/lib/format";
import type { Departure, DepartureStatus } from "@/lib/types";

interface Row extends Departure {
  package_title: string;
  theme_name: string;
  theme_slug: string;
}

export function DepartureTable() {
  const toast = useToast();
  const load = useCallback(() => api.staff.packages.list(), []);
  const { data: pkgs, setData: setPkgs, loading } = useLoad(load);
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState<"" | DepartureStatus>("");
  const [pkgId, setPkgId] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);

  const all = useMemo<Row[]>(
    () =>
      (pkgs ?? [])
        .flatMap((p) =>
          p.departures.map((d) => ({
            ...d,
            package_title: p.title,
            theme_name: p.theme.name,
            theme_slug: p.theme.slug,
          })),
        )
        .sort((a, b) => a.depart_date.localeCompare(b.depart_date)),
    [pkgs],
  );
  const months = useMemo(
    () => Array.from(new Set(all.map((d) => d.depart_date.slice(0, 7)))).sort(),
    [all],
  );

  const rows = all.filter(
    (d) =>
      (!month || d.depart_date.startsWith(month)) &&
      (!status || d.status === status) &&
      (!pkgId || String(d.package_id) === pkgId),
  );

  const changeStatus = async (d: Row, next: DepartureStatus) => {
    setUpdating(d.id);
    try {
      const res = await api.staff.packages.updateDeparture(d.package_id, d.id, {
        depart_date: d.depart_date,
        return_date: d.return_date,
        capacity: d.capacity,
        status: next,
      });
      setPkgs((prev) =>
        (prev ?? []).map((p) =>
          p.id !== d.package_id
            ? p
            : {
                ...p,
                departures: p.departures.map((x) => (x.id === d.id ? res : x)),
              },
        ),
      );
      toast(
        `${shortDate(d.depart_date)} 출발 일정을 "${DEPARTURE_STATUS[next]}"으로 바꿨어요`,
        "success",
      );
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setUpdating(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const cols: Column<Row>[] = [
    {
      key: "depart",
      header: "출발일",
      width: "w-[130px]",
      render: (d) => (
        <span
          className={
            d.depart_date < today
              ? "text-muted tabular"
              : "font-semibold tabular"
          }
        >
          {d.depart_date}
        </span>
      ),
    },
    {
      key: "return",
      header: "귀국일",
      width: "w-[120px]",
      render: (d) => (
        <span className="tabular text-ink-2">{d.return_date}</span>
      ),
    },
    {
      key: "pkg",
      header: "상품",
      wrap: true,
      render: (d) => (
        <Link
          href={`/staff/packages/${d.package_id}?tab=departures`}
          className="line-clamp-1 font-medium hover:text-primary"
        >
          {d.package_title}
        </Link>
      ),
    },
    {
      key: "theme",
      header: "테마",
      width: "w-[150px]",
      render: (d) => <span className="text-ink-2">{d.theme_name}</span>,
    },
    {
      key: "cap",
      header: "정원",
      align: "right",
      width: "w-[70px]",
      render: (d) => `${d.capacity}명`,
    },
    {
      key: "booked",
      header: "예약",
      align: "right",
      width: "w-[70px]",
      render: (d) => `${d.booked}명`,
    },
    {
      key: "remaining",
      header: "잔여",
      align: "right",
      width: "w-[80px]",
      render: (d) =>
        d.remaining === 0 ? (
          <Badge tone="danger">마감</Badge>
        ) : d.remaining <= 3 ? (
          <Badge tone="warning">{d.remaining}석</Badge>
        ) : (
          `${d.remaining}석`
        ),
    },
    {
      key: "status",
      header: "상태",
      width: "w-[130px]",
      render: (d) => (
        <div className="w-[118px]">
          <Select
            value={d.status}
            disabled={updating === d.id}
            onChange={(e) => changeStatus(d, e.target.value as DepartureStatus)}
            className="h-8 text-[13px]"
            aria-label="출발일정 상태"
          >
            {(Object.keys(DEPARTURE_STATUS) as DepartureStatus[]).map((s) => (
              <option key={s} value={s}>
                {DEPARTURE_STATUS[s]}
              </option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      key: "go",
      header: "",
      align: "right",
      width: "w-[100px]",
      render: (d) => (
        <Link
          href={`/staff/bookings?departure_id=${d.id}`}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-primary hover:bg-primary-soft"
        >
          예약 보기 <ArrowRight className="size-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="출발일정"
        description={`전체 상품의 출발일정 ${all.length}개 · 상태는 표에서 바로 바꿀 수 있어요.`}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="w-[160px]">
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10"
              aria-label="출발월 필터"
            >
              <option value="">모든 월</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[140px]">
            <Select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "" | DepartureStatus)
              }
              className="h-10"
              aria-label="상태 필터"
            >
              <option value="">모든 상태</option>
              {(Object.keys(DEPARTURE_STATUS) as DepartureStatus[]).map((s) => (
                <option key={s} value={s}>
                  {DEPARTURE_STATUS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[280px]">
            <Select
              value={pkgId}
              onChange={(e) => setPkgId(e.target.value)}
              className="h-10"
              aria-label="상품 필터"
            >
              <option value="">모든 상품</option>
              {(pkgs ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
          <span className="ml-auto text-[13px] text-muted tabular">
            {rows.length}개 표시
          </span>
        </div>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(d) => d.id}
          loading={loading}
          maxHeight="max-h-[calc(100dvh-260px)]"
          emptyTitle="조건에 맞는 출발일정이 없어요"
        />
      </Card>
    </>
  );
}
