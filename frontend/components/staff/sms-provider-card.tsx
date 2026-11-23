"use client";

import { MessageSquareText, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { phoneFormat } from "@/lib/format";
import type { Notification, SmsProviderStatus } from "@/lib/types";
import { errMsg } from "./lib";

const DEFAULT_BODY = "미스터 월드 문자 발송 테스트입니다.";

const ENV_SNIPPET = `# backend/.env
SMS_PROVIDER=solapi
SOLAPI_API_KEY=발급받은_API_KEY
SOLAPI_API_SECRET=발급받은_API_SECRET
SMS_FROM=01012345678   # 솔라피에 등록한 발신번호

# 저장 후 백엔드 재시작
uvicorn app.main:app --port 8000`;

/** "010-1234-5678" → 가운데 가림 "010-****-5678" */
function maskSender(v: string) {
  const f = phoneFormat(v);
  const parts = f.split("-");
  if (parts.length === 3) return `${parts[0]}-${"*".repeat(parts[1].length)}-${parts[2]}`;
  return f.length > 4 ? `${"*".repeat(f.length - 4)}${f.slice(-4)}` : f;
}

/** 문자 발송 프로바이더 라벨 (테이블 배지와 카드가 공유) */
export function providerLabel(p: string | null | undefined) {
  if (p === "solapi") return "CoolSMS";
  if (p === "console") return "기록만";
  return p ?? "기록만";
}

/**
 * 알림 로그 상단 "문자 발송 설정" 카드.
 * 프로바이더 상태(console / solapi) + 미설정 시 .env 안내 + 테스트 발송 폼.
 */
export function SmsProviderCard({
  status,
  loading,
  onSent,
}: {
  status: SmsProviderStatus | null;
  loading: boolean;
  /** 테스트 발송 결과 행 — 부모가 테이블 맨 위에 끼워 넣는다 */
  onSent: (row: Notification) => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sending, setSending] = useState(false);

  const live = !!status?.live;
  const wantsSolapi = status?.requested === "solapi";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 9) {
      toast("휴대폰 번호를 확인해 주세요", "error");
      return;
    }
    setSending(true);
    try {
      const row = await api.staff.sms.test(phone, body.trim() || DEFAULT_BODY);
      onSent(row);
      if (row.status === "failed") toast(`발송 실패: ${row.error ?? "원인 미상"}`, "error");
      else toast(live ? `${phoneFormat(phone)} 로 문자를 보냈어요` : "실발송 없이 기록만 남겼어요 (console)", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mb-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <MessageSquareText className="size-[18px]" aria-hidden />
            </span>
            <h2 className="text-[16px] font-bold text-ink">문자 발송 설정</h2>
            {loading || !status ? (
              <Skeleton className="h-6 w-28" />
            ) : live ? (
              <Badge tone="success">CoolSMS 실발송 중</Badge>
            ) : (
              <Badge tone="neutral">기록만 (실제 발송 안 함)</Badge>
            )}
          </div>

          {status && (
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">프로바이더</dt>
              <dd className="font-semibold text-ink">
                {status.provider === "solapi" ? "CoolSMS (Solapi)" : "console"}
                {wantsSolapi && !status.configured && (
                  <span className="ml-2 font-medium text-danger">SMS_PROVIDER=solapi 로 요청됐지만 키가 비어 있어 console 로 동작 중</span>
                )}
              </dd>
              <dt className="text-muted">발신번호</dt>
              <dd className="font-semibold tabular text-ink">{status.sender ? maskSender(status.sender) : "미설정"}</dd>
            </dl>
          )}

          {status && !status.configured && (
            <div className="mt-4">
              <p className="text-[13px] text-ink-2">
                실제 문자를 보내려면 CoolSMS(Solapi) 키를 <code className="rounded bg-bg px-1 text-[12px]">backend/.env</code> 에 넣고
                백엔드를 다시 시작하세요.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-[var(--radius-input)] border border-line bg-bg px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink-2">
                {ENV_SNIPPET}
              </pre>
            </div>
          )}
        </div>

        <form onSubmit={send} className="w-full rounded-[var(--radius-card)] border border-line bg-bg p-4 lg:w-[360px]" aria-label="테스트 발송">
          <p className="text-[14px] font-bold text-ink">테스트 발송</p>
          <p className="mt-0.5 text-[12px] text-muted">
            {live ? "입력한 번호로 실제 문자가 발송됩니다." : "console 모드에서는 발송하지 않고 아래 로그에만 기록됩니다."}
          </p>
          <Field label="수신 번호" className="mt-3">
            <Input
              inputMode="tel"
              autoComplete="off"
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(phoneFormat(e.target.value))}
              aria-label="테스트 수신 번호"
            />
          </Field>
          <Field label="내용" className="mt-3">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[72px]" aria-label="테스트 문자 내용" />
          </Field>
          <Button type="submit" full className="mt-3" loading={sending} aria-label="테스트 문자 보내기">
            <Send className="size-4" aria-hidden />
            보내기
          </Button>
        </form>
      </div>
    </Card>
  );
}
