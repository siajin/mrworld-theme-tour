"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { errMsg } from "@/components/staff/lib";
import {
  ConfirmDialog,
  type ConfirmState,
} from "@/components/staff/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { PageHeader } from "@/components/staff/ui/page-header";
import { Switch } from "@/components/staff/ui/switch";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Photo } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { duration, STYLE_LABEL, won } from "@/lib/format";
import type { Package } from "@/lib/types";

export function PackageTable() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [theme, setTheme] = useState(searchParams.get("theme") ?? "");
  const [published, setPublished] = useState<"" | "true" | "false">("");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  const loadThemes = useCallback(() => api.staff.themes.list(), []);
  const { data: themes } = useLoad(loadThemes);
  const loadPkgs = useCallback(() => api.staff.packages.list(), []);
  const { data: pkgs, setData: setPkgs, loading } = useLoad(loadPkgs);

  const rows = useMemo(() => {
    const list = pkgs ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter(
      (p) =>
        (!theme || p.theme.slug === theme) &&
        (!published || String(p.is_published) === published) &&
        (!needle ||
          p.title.toLowerCase().includes(needle) ||
          p.region.toLowerCase().includes(needle) ||
          p.country.toLowerCase().includes(needle)),
    );
  }, [pkgs, theme, published, q]);

  const togglePublish = async (p: Package, next: boolean) => {
    setToggling(p.id);
    try {
      const updated = await api.staff.packages.publish(p.id, next);
      setPkgs((prev) =>
        (prev ?? []).map((x) =>
          x.id === p.id ? { ...x, is_published: updated.is_published } : x,
        ),
      );
      toast(
        next
          ? `"${p.title}" 을(를) 노출했어요`
          : `"${p.title}" 을(를) 비노출로 바꿨어요`,
        "success",
      );
    } catch (e) {
      toast(errMsg(e), "error");
    } finally {
      setToggling(null);
    }
  };

  const askDelete = (p: Package) =>
    setConfirm({
      title: "상품을 삭제할까요?",
      description: (
        <>
          <b>{p.title}</b> 상품과 출발일정이 함께 삭제됩니다. 예약이 있는 상품은
          삭제되지 않을 수 있어요.
        </>
      ),
      confirmLabel: "삭제",
      tone: "danger",
      onConfirm: async () => {
        try {
          await api.staff.packages.remove(p.id);
          setPkgs((prev) => (prev ?? []).filter((x) => x.id !== p.id));
          toast("상품을 삭제했어요", "success");
        } catch (e) {
          toast(errMsg(e), "error");
        }
      },
    });

  const cols: Column<Package>[] = [
    {
      key: "thumb",
      header: "",
      width: "w-[72px]",
      render: (p) => (
        <Photo
          src={p.hero_images[0]}
          alt={p.title}
          className="h-9 w-12 rounded-md"
        />
      ),
    },
    {
      key: "title",
      header: "제목",
      wrap: true,
      render: (p) => (
        <div className="min-w-[240px]">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/staff/packages/${p.id}`}
              className="line-clamp-1 font-semibold text-ink hover:text-primary"
            >
              {p.title}
            </Link>
            {p.badges.slice(0, 2).map((b) => (
              <Badge key={b} tone="neutral" className="px-1.5 text-[11px]">
                {b}
              </Badge>
            ))}
          </div>
          <p className="line-clamp-1 text-[12px] text-muted">{p.subtitle}</p>
        </div>
      ),
    },
    {
      key: "theme",
      header: "테마",
      width: "w-[130px]",
      render: (p) => <span className="text-ink-2">{p.theme.name}</span>,
    },
    {
      key: "region",
      header: "지역",
      width: "w-[120px]",
      wrap: true,
      render: (p) => (
        <span className="line-clamp-2 text-[13px]">
          {p.region} · {p.country}
        </span>
      ),
    },
    {
      key: "dur",
      header: "박/일",
      width: "w-[80px]",
      render: (p) => (
        <span className="tabular">{duration(p.nights, p.days)}</span>
      ),
    },
    {
      key: "price",
      header: "최저가",
      align: "right",
      width: "w-[110px]",
      render: (p) => (
        <div>
          <p className="font-semibold">{won(p.from_price)}</p>
          <p className="text-[11px] leading-tight text-muted">{STYLE_LABEL[p.from_style]}~</p>
        </div>
      ),
    },
    {
      key: "deps",
      header: "출발일정",
      align: "right",
      width: "w-[80px]",
      render: (p) => `${p.departures.length}개`,
    },
    {
      key: "pub",
      header: "노출",
      width: "w-[70px]",
      render: (p) => (
        <Switch
          checked={p.is_published}
          disabled={toggling === p.id}
          onChange={(v) => togglePublish(p, v)}
          label={`${p.title} 노출`}
          size="sm"
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-[90px]",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/staff/packages/${p.id}`}
            aria-label="수정"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            aria-label="삭제"
            onClick={() => askDelete(p)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="상품 관리"
        description={`총 ${pkgs?.length ?? 0}개 상품 · 노출 ${pkgs?.filter((p) => p.is_published).length ?? 0}개`}
        actions={
          <Button size="sm" onClick={() => router.push("/staff/packages/new")}>
            <Plus className="size-4" />새 상품
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative w-[240px]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="제목·지역 검색"
              className="h-10 pl-9"
              aria-label="상품 검색"
            />
          </div>
          <div className="w-[180px]">
            <Select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="h-10"
              aria-label="테마 필터"
            >
              <option value="">모든 테마</option>
              {(themes ?? []).map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[150px]">
            <Select
              value={published}
              onChange={(e) =>
                setPublished(e.target.value as "" | "true" | "false")
              }
              className="h-10"
              aria-label="노출 여부 필터"
            >
              <option value="">노출 여부 전체</option>
              <option value="true">노출 중</option>
              <option value="false">비노출</option>
            </Select>
          </div>
          <span className="ml-auto text-[13px] text-muted tabular">
            {rows.length}개 표시
          </span>
        </div>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(p) => p.id}
          loading={loading}
          maxHeight="max-h-[calc(100dvh-260px)]"
          emptyTitle="조건에 맞는 상품이 없어요"
          emptyDescription="필터를 바꾸거나 새 상품을 등록해 보세요."
          emptyAction={
            <Button
              size="sm"
              onClick={() => router.push("/staff/packages/new")}
            >
              <Plus className="size-4" />새 상품
            </Button>
          }
        />
      </Card>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
