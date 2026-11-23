"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { PageHeader } from "@/components/staff/ui/page-header";
import { ActiveBadge, MoveTypeBadge } from "@/components/staff/ui/status-badge";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { InventoryItem, InventoryMove } from "@/lib/types";
import { ItemModal, type ItemModalState } from "./item-modal";
import { MoveModal } from "./move-modal";

type TabKey = "items" | "moves";
type MoveType = InventoryMove["type"];

export function InventoryPage() {
  const [tab, setTab] = useState<TabKey>("items");
  const loadItems = useCallback(() => api.staff.inventory.items(), []);
  const { data: items, setData: setItems, loading, reload: reloadItems } = useLoad(loadItems);
  const [itemModal, setItemModal] = useState<ItemModalState | null>(null);
  const [move, setMove] = useState<{
    item: InventoryItem;
    type: MoveType;
  } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // 이력
  const [moveItemId, setMoveItemId] = useState("");
  const [moveType, setMoveType] = useState<"" | MoveType>("");
  const loadMoves = useCallback(
    () =>
      api.staff.inventory.moves(moveItemId ? Number(moveItemId) : undefined),
    [moveItemId],
  );
  const {
    data: moves,
    setData: setMoves,
    loading: movesLoading,
    reload: reloadMoves,
  } = useLoad(loadMoves);

  useEffect(() => {
    if (itemModal || move) return;
    let alive = true;
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      try {
        const [nextItems, nextMoves] = await Promise.all([loadItems(), loadMoves()]);
        if (alive) {
          setItems(nextItems);
          setMoves(nextMoves);
        }
      } catch {
        // 기존 수량을 유지하고 다음 갱신 또는 수동 새로고침에서 재시도한다.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [itemModal, move, loadItems, loadMoves, setItems, setMoves]);

  const itemRows = useMemo(
    () => (items ?? []).filter((it) => showInactive || it.is_active),
    [items, showInactive],
  );
  const moveRows = useMemo(
    () => (moves ?? []).filter((m) => !moveType || m.type === moveType),
    [moves, moveType],
  );
  const lowCount = (items ?? []).filter(
    (it) => it.low_stock && it.is_active,
  ).length;

  const onMoved = (updated: InventoryItem) => {
    setItems((prev) =>
      (prev ?? []).map((x) => (x.id === updated.id ? updated : x)),
    );
    reloadMoves();
  };

  const itemCols: Column<InventoryItem>[] = [
    {
      key: "sku",
      header: "SKU",
      width: "w-[120px]",
      render: (it) => (
        <span className="font-mono text-[13px] text-ink-2">{it.sku}</span>
      ),
    },
    {
      key: "name",
      header: "물품명",
      render: (it) => (
        <span
          className={
            it.is_active ? "font-semibold" : "font-semibold text-muted"
          }
        >
          {it.name}
        </span>
      ),
    },
    {
      key: "cat",
      header: "카테고리",
      width: "w-[120px]",
      render: (it) => <span className="text-ink-2">{it.category || "-"}</span>,
    },
    {
      key: "stock",
      header: "재고",
      align: "right",
      width: "w-[120px]",
      render: (it) => (
        <span className="inline-flex items-center justify-end gap-2">
          {it.low_stock && <Badge tone="danger">부족</Badge>}
          <span
            className={it.low_stock ? "font-bold text-danger" : "font-semibold"}
          >
            {it.stock_qty.toLocaleString("ko-KR")}
          </span>
        </span>
      ),
    },
    {
      key: "reorder",
      header: "안전재고",
      align: "right",
      width: "w-[90px]",
      render: (it) => <span className="text-muted">{it.reorder_level}</span>,
    },
    { key: "unit", header: "단위", width: "w-[70px]", render: (it) => it.unit },
    {
      key: "active",
      header: "상태",
      width: "w-[80px]",
      render: (it) => <ActiveBadge active={it.is_active} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-[280px]",
      render: (it) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-2.5 text-[12px]"
            onClick={() => setMove({ item: it, type: "in" })}
          >
            <ArrowDownToLine className="size-3.5" />
            입고
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-[12px]"
            onClick={() => setMove({ item: it, type: "out" })}
            disabled={it.stock_qty === 0}
          >
            <ArrowUpFromLine className="size-3.5" />
            출고
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-[12px]"
            onClick={() => setMove({ item: it, type: "adjust" })}
          >
            <SlidersHorizontal className="size-3.5" />
            조정
          </Button>
          <button
            type="button"
            aria-label="수정"
            onClick={() => setItemModal({ item: it })}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  const moveCols: Column<InventoryMove>[] = [
    {
      key: "at",
      header: "일시",
      width: "w-[150px]",
      render: (m) => (
        <span className="tabular text-ink-2">{dateTime(m.created_at)}</span>
      ),
    },
    {
      key: "item",
      header: "물품",
      render: (m) => <span className="font-medium">{m.item_name}</span>,
    },
    {
      key: "type",
      header: "유형",
      width: "w-[80px]",
      render: (m) => <MoveTypeBadge type={m.type} />,
    },
    {
      key: "qty",
      header: "수량",
      align: "right",
      width: "w-[90px]",
      render: (m) => (
        <span
          className={
            m.type === "in"
              ? "font-semibold text-success"
              : m.type === "out"
                ? "font-semibold text-danger"
                : "font-semibold"
          }
        >
          {m.type === "in" ? "+" : m.type === "out" ? "-" : "="}
          {m.qty.toLocaleString("ko-KR")}
        </span>
      ),
    },
    {
      key: "ref",
      header: "관련 예약",
      width: "w-[110px]",
      render: (m) =>
        m.ref_booking_id ? (
          <Link
            href={`/staff/bookings?booking_id=${m.ref_booking_id}`}
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            #{m.ref_booking_id}
          </Link>
        ) : (
          <span className="text-muted-2">-</span>
        ),
    },
    {
      key: "memo",
      header: "메모",
      wrap: true,
      render: (m) => (
        <span className="line-clamp-1 text-ink-2">{m.memo || "-"}</span>
      ),
    },
    {
      key: "by",
      header: "담당자",
      width: "w-[100px]",
      render: (m) => <span className="text-ink-2">{m.created_by_name}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="물품 창고"
        description={
          lowCount > 0 ? (
            <span>
              활성 물품 {itemRows.filter((i) => i.is_active).length}개 ·{" "}
              <span className="font-semibold text-danger">
                재고 부족 {lowCount}개
              </span>
            </span>
          ) : (
            `활성 물품 ${(items ?? []).filter((i) => i.is_active).length}개 · 모든 재고가 안전재고 이상`
          )
        }
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => { reloadItems(); reloadMoves(); }}>
              <RefreshCw className="size-4" />새로고침
            </Button>
            <Button size="sm" onClick={() => setItemModal({})}>
              <Plus className="size-4" />새 물품
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <Tabs<TabKey>
          items={[
            { value: "items", label: "물품 목록", count: items?.length },
            { value: "moves", label: "입출고 이력", count: moves?.length },
          ]}
          value={tab}
          onChange={setTab}
          className="px-2"
        />

        {tab === "items" ? (
          <>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <label className="inline-flex items-center gap-2 text-[13px] text-ink-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                비활성 물품도 보기
              </label>
              <span className="ml-auto text-[12px] text-muted">
                결제 완료·직원 확정 시 기본 제공 물품을 차감하고, 인원 변경·취소 시 수량을 조정합니다.
              </span>
            </div>
            <DataTable
              columns={itemCols}
              rows={itemRows}
              rowKey={(it) => it.id}
              loading={loading}
              maxHeight="max-h-[calc(100dvh-300px)]"
              emptyTitle="등록된 물품이 없어요"
              emptyAction={
                <Button size="sm" onClick={() => setItemModal({})}>
                  <Plus className="size-4" />새 물품
                </Button>
              }
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="w-[220px]">
                <Select
                  value={moveItemId}
                  onChange={(e) => setMoveItemId(e.target.value)}
                  className="h-10"
                  aria-label="물품 필터"
                >
                  <option value="">모든 물품</option>
                  {(items ?? []).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-[130px]">
                <Select
                  value={moveType}
                  onChange={(e) => setMoveType(e.target.value as "" | MoveType)}
                  className="h-10"
                  aria-label="유형 필터"
                >
                  <option value="">모든 유형</option>
                  <option value="in">입고</option>
                  <option value="out">출고</option>
                  <option value="adjust">조정</option>
                </Select>
              </div>
              <span className="ml-auto text-[13px] text-muted tabular">
                {moveRows.length}건
              </span>
            </div>
            <DataTable
              columns={moveCols}
              rows={moveRows}
              rowKey={(m) => m.id}
              loading={movesLoading}
              maxHeight="max-h-[calc(100dvh-300px)]"
              emptyTitle="입출고 이력이 없어요"
            />
          </>
        )}
      </Card>

      <ItemModal
        state={itemModal}
        onClose={() => setItemModal(null)}
        onSaved={(it, mode) => {
          setItems((prev) =>
            mode === "create"
              ? [...(prev ?? []), it]
              : (prev ?? []).map((x) => (x.id === it.id ? it : x)),
          );
          if (mode === "create") reloadMoves();
        }}
      />
      <MoveModal
        item={move?.item ?? null}
        initialType={move?.type ?? "in"}
        onClose={() => setMove(null)}
        onDone={onMoved}
      />
    </>
  );
}
