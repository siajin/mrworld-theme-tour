"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Skeleton, EmptyState } from "@/components/ui/misc";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  /** Tailwind 너비 클래스 (예: "w-[120px]") */
  width?: string;
  className?: string;
  /** true 면 셀 내용 줄바꿈 허용 (기본은 nowrap) */
  wrap?: boolean;
  render: (row: T, index: number) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  /** 스크롤 컨테이너 최대 높이. 지정하면 헤더가 고정된다. */
  maxHeight?: string;
  dense?: boolean;
  className?: string;
}

const alignCls = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

/** 직원 화면 공용 테이블: 행 높이 48px, 숫자 우측 정렬, 고정 헤더. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  emptyTitle = "데이터가 없어요",
  emptyDescription,
  emptyAction,
  onRowClick,
  selectedKey,
  maxHeight,
  dense = false,
  className,
}: Props<T>) {
  const rowH = dense ? "h-10" : "h-12";
  return (
    <div className={clsx("overflow-auto", maxHeight, className)}>
      <table className="min-w-full border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={clsx(
                  "sticky top-0 z-10 h-10 border-b border-line bg-bg px-3 text-[12px] font-semibold text-muted whitespace-nowrap first:pl-4 last:pr-4",
                  alignCls[c.align ?? "left"],
                  c.width,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`sk-${i}`} className={rowH}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className="border-b border-line px-3 first:pl-4 last:pr-4"
                  >
                    <Skeleton className="h-4 w-[70%]" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                />
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const k = rowKey(row);
              const selected = selectedKey != null && selectedKey === k;
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    rowH,
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-bg",
                    selected && "bg-primary-soft",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={clsx(
                        "border-b border-line px-3 text-ink first:pl-4 last:pr-4 align-middle",
                        c.wrap ? "whitespace-normal" : "whitespace-nowrap",
                        alignCls[c.align ?? "left"],
                        c.align === "right" && "tabular",
                        c.className,
                      )}
                    >
                      {c.render(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
