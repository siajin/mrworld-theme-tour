"use client";

import {
  ArrowDown,
  ArrowUp,
  Car,
  Gift,
  Package,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { errMsg } from "@/components/staff/lib";
import { ThemeIcon } from "@/components/staff/theme-icon";
import {
  ConfirmDialog,
  type ConfirmState,
} from "@/components/staff/ui/confirm-dialog";
import { PageHeader } from "@/components/staff/ui/page-header";
import { ActiveBadge } from "@/components/staff/ui/status-badge";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Photo, Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { STYLE_LABEL, won } from "@/lib/format";
import type { StyleCode, Theme } from "@/lib/types";
import { ThemeFormModal, type ThemeFormState } from "./theme-form";

const RANK_STYLE: Record<1 | 2 | 3, StyleCode> = {
  1: "classic",
  2: "grand",
  3: "premium",
};

export function ThemeGrid() {
  const toast = useToast();
  const load = useCallback(() => api.staff.themes.list(), []);
  const { data: themes, setData: setThemes, loading } = useLoad(load);
  const loadItems = useCallback(() => api.staff.inventory.items(), []);
  const { data: items } = useLoad(loadItems);
  const [form, setForm] = useState<ThemeFormState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [reordering, setReordering] = useState(false);

  const list = [...(themes ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setReordering(true);
    setThemes(next.map((t, k) => ({ ...t, sort_order: k + 1 })));
    try {
      const res = await api.staff.themes.reorder(next.map((t) => t.id));
      setThemes(res);
      toast("테마 순서를 저장했어요", "success");
    } catch (e) {
      toast(errMsg(e), "error");
      setThemes(list);
    } finally {
      setReordering(false);
    }
  };

  const askDelete = (t: Theme) =>
    setConfirm({
      title: "테마를 삭제할까요?",
      description: (
        <>
          <b>{t.name}</b> 테마를 삭제합니다. 상품이 연결된 테마는 삭제할 수
          없어요 (상품 {t.package_count ?? 0}개).
        </>
      ),
      confirmLabel: "삭제",
      tone: "danger",
      onConfirm: async () => {
        try {
          await api.staff.themes.remove(t.id);
          setThemes((prev) => (prev ?? []).filter((x) => x.id !== t.id));
          toast("테마를 삭제했어요", "success");
        } catch (e) {
          toast(errMsg(e), "error");
        }
      },
    });

  return (
    <>
      <PageHeader
        title="테마 관리"
        description="고객 홈에 표시되는 순서대로 나열됩니다. 화살표로 순서를 바꿀 수 있어요."
        actions={
          <Button size="sm" onClick={() => setForm({})}>
            <Plus className="size-4" />새 테마
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[260px]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            title="등록된 테마가 없어요"
            description="허니문, 효도, 골프처럼 상품을 묶는 테마를 먼저 만들어 주세요."
            action={
              <Button size="sm" onClick={() => setForm({})}>
                <Plus className="size-4" />새 테마
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t, i) => (
            <Card key={t.id} className="flex flex-col overflow-hidden">
              <div className="relative">
                <Photo
                  src={t.hero_image}
                  alt={t.name}
                  className="h-[120px] w-full"
                />
                <div className="absolute left-3 top-3 flex items-center gap-1.5">
                  <span className="inline-flex size-7 items-center justify-center rounded-md bg-white/90 text-[12px] font-bold text-ink tabular shadow-sm">
                    {i + 1}
                  </span>
                  <ActiveBadge active={t.is_active} />
                </div>
                <div className="absolute right-3 top-3 flex gap-1">
                  <button
                    type="button"
                    aria-label="위로"
                    disabled={i === 0 || reordering}
                    onClick={() => move(i, -1)}
                    className="inline-flex size-7 items-center justify-center rounded-md bg-white/90 text-ink shadow-sm hover:bg-white disabled:opacity-40"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="아래로"
                    disabled={i === list.length - 1 || reordering}
                    onClick={() => move(i, 1)}
                    className="inline-flex size-7 items-center justify-center rounded-md bg-white/90 text-ink shadow-sm hover:bg-white disabled:opacity-40"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <ThemeIcon name={t.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[16px] font-bold text-ink">
                        {t.name}
                      </h3>
                      <span className="font-mono text-[11px] text-muted-2">
                        {t.slug}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">
                      {t.tagline || "슬로건 없음"}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Package className="size-4 text-muted" aria-hidden />
                    <dt className="sr-only">최소 스타일</dt>
                    <dd>
                      {STYLE_LABEL[RANK_STYLE[t.min_style_rank]]}
                      {t.min_style_rank === 3 ? "만" : "부터"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Users className="size-4 text-muted" aria-hidden />
                    <dt className="sr-only">최소 인원</dt>
                    <dd>최소 {t.min_travelers}명 출발</dd>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Car className="size-4 text-muted" aria-hidden />
                    <dt className="sr-only">차량</dt>
                    <dd className="truncate">{t.vehicle_label || "-"}</dd>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-2">
                    <Gift className="size-4 text-muted" aria-hidden />
                    <dt className="sr-only">기본 제공</dt>
                    <dd>기본 제공 {t.perks.length}개</dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Link
                      href={`/staff/packages?theme=${t.slug}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      상품 {t.package_count ?? 0}개
                    </Link>
                    {t.from_price != null && (
                      <Badge tone="neutral">{won(t.from_price)}~</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="수정"
                      onClick={() => setForm({ theme: t })}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="삭제"
                      onClick={() => askDelete(t)}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ThemeFormModal
        state={form}
        items={items ?? []}
        onClose={() => setForm(null)}
        onSaved={(t, mode) =>
          setThemes((prev) =>
            mode === "create"
              ? [...(prev ?? []), t]
              : (prev ?? []).map((x) => (x.id === t.id ? { ...x, ...t } : x)),
          )
        }
      />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
