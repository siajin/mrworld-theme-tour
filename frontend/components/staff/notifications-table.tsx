"use client";

import { ChevronDown, Info, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { PageHeader } from "@/components/staff/ui/page-header";
import { useLoad } from "@/components/staff/use-load";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { dateTime, phoneFormat } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { errMsg } from "./lib";
import { SmsProviderCard, providerLabel } from "./sms-provider-card";

const TEMPLATE_LABEL: Record<string, string> = {
  booking_confirmed: "예약 확정",
  companion_joined: "동행 합류",
  booking_cancelled: "예약 취소",
  inventory_short: "재고 부족",
  test: "테스트",
};

function statusMeta(n: Notification, live: boolean): { label: string; tone: BadgeTone } {
  if (n.status === "failed") return { label: "실패", tone: "danger" };
  if (n.status === "queued") return { label: "대기", tone: "neutral" };
  // sent: 실발송 프로바이더면 "발송", 기록만이면 "기록됨"
  return n.provider === "solapi" || (live && n.provider == null) ? { label: "발송", tone: "success" } : { label: "기록됨", tone: "success" };
}

export function NotificationsTable() {
  const toast = useToast();
  const [limit, setLimit] = useState(100);
  const [template, setTemplate] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [resending, setResending] = useState<number | null>(null);

  const load = useCallback(() => api.staff.notifications(limit), [limit]);
  const { data, setData, loading, reload } = useLoad(load);

  const loadProvider = useCallback(() => api.staff.sms.provider(), []);
  const { data: provider, loading: providerLoading } = useLoad(loadProvider);
  const live = !!provider?.live;

  const templates = useMemo(() => Array.from(new Set((data ?? []).map((n) => n.template))), [data]);
  const rows = useMemo(() => (data ?? []).filter((n) => !template || n.template === template), [data, template]);

  const prepend = useCallback((row: Notification) => setData((prev) => [row, ...(prev ?? []).filter((n) => n.id !== row.id)]), [setData]);

  const resend = async (n: Notification) => {
    setResending(n.id);
    try {
      const row = await api.staff.sms.resend(n.id);
      if (row.status === "failed") toast(`재발송 실패: ${row.error ?? "원인 미상"}`, "error");
      else toast(live ? "다시 보냈어요" : "재발송을 기록했어요 (console)", "success");
      reload();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setResending(null);
    }
  };

  const cols: Column<Notification>[] = [
    {
      key: "at",
      header: "일시",
      width: "w-[150px]",
      render: (n) => <span className="tabular text-ink-2">{dateTime(n.created_at)}</span>,
    },
    {
      key: "user",
      header: "수신자",
      width: "w-[100px]",
      render: (n) => <span className="font-semibold">{n.user_name}</span>,
    },
    {
      key: "to",
      header: "수신번호",
      width: "w-[130px]",
      render: (n) => (n.to ? <span className="tabular text-ink-2">{phoneFormat(n.to)}</span> : <span className="text-muted-2">-</span>),
    },
    {
      key: "provider",
      header: "발송",
      width: "w-[90px]",
      render: (n) => <Badge tone={n.provider === "solapi" ? "info" : "muted"}>{providerLabel(n.provider)}</Badge>,
    },
    {
      key: "tpl",
      header: "템플릿",
      width: "w-[100px]",
      render: (n) => <span className="text-[13px] text-ink-2">{TEMPLATE_LABEL[n.template] ?? n.template}</span>,
    },
    {
      key: "body",
      header: "제목 · 본문",
      wrap: true,
      render: (n) => {
        const expanded = open === n.id;
        return (
          <div className="min-w-[280px] py-1">
            <p className="font-semibold text-ink">{n.title}</p>
            <p className={expanded ? "mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2" : "line-clamp-1 text-[13px] text-muted"}>
              {n.body}
            </p>
            {n.status === "failed" && n.error && (
              <p className={expanded ? "mt-1.5 whitespace-pre-wrap text-[12.5px] text-danger" : "mt-1 line-clamp-1 text-[12.5px] text-danger"}>
                {n.error}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "상태",
      width: "w-[150px]",
      render: (n) => {
        const m = statusMeta(n, live);
        return (
          <span className="flex items-center gap-2">
            <Badge tone={m.tone}>{m.label}</Badge>
            {n.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                loading={resending === n.id}
                onClick={(e) => {
                  e.stopPropagation();
                  resend(n);
                }}
                aria-label={`${n.user_name} 문자 재발송`}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                재발송
              </Button>
            )}
          </span>
        );
      },
    },
    {
      key: "toggle",
      header: "",
      width: "w-[40px]",
      render: (n) => (
        <ChevronDown className={open === n.id ? "size-4 rotate-180 text-muted transition-transform" : "size-4 text-muted transition-transform"} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="알림 로그"
        description="고객에게 발송되는 문자 내용을 기록합니다."
        actions={
          <Button variant="outline" size="sm" onClick={reload}>
            새로 고침
          </Button>
        }
      />

      <SmsProviderCard status={provider} loading={providerLoading} onSent={prepend} />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {providerLoading && !provider ? (
          <p className="text-muted">발송 설정을 확인하는 중…</p>
        ) : live ? (
          <p>
            <b>CoolSMS 로 실제 문자를 보내고 있어요.</b> 예약 확정, 동행 합류, 예약 취소 시 대표자와 동행에게 문자가 발송되고 결과가 여기에
            남습니다. 실패한 건은 <b>재발송</b> 버튼으로 다시 보낼 수 있어요.
          </p>
        ) : (
          <p>
            <b>지금은 실제 문자를 보내지 않고 발송 내용만 기록합니다 (console).</b> 예약 확정, 동행 합류, 예약 취소 시 보낼 문자가 여기에
            남습니다. 위 카드의 안내대로 CoolSMS 키를 설정하면 이 기록이 그대로 발송됩니다.
          </p>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="w-[160px]">
            <Select value={template} onChange={(e) => setTemplate(e.target.value)} className="h-10" aria-label="템플릿 필터">
              <option value="">모든 템플릿</option>
              {templates.map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABEL[t] ?? t}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[130px]">
            <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="h-10" aria-label="표시 개수">
              <option value={50}>최근 50건</option>
              <option value={100}>최근 100건</option>
              <option value={300}>최근 300건</option>
            </Select>
          </div>
          <span className="ml-auto text-[13px] text-muted tabular">{rows.length}건</span>
        </div>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(n) => n.id}
          loading={loading}
          onRowClick={(n) => setOpen((cur) => (cur === n.id ? null : n.id))}
          selectedKey={open}
          maxHeight="max-h-[calc(100dvh-330px)]"
          emptyTitle="기록된 알림이 없어요"
          emptyDescription="예약이 확정되거나 동행이 합류하면 여기에 기록됩니다."
        />
      </Card>
    </>
  );
}
