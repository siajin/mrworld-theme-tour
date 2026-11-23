"use client";

import { Crown, Link2, Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { errMsg } from "@/components/staff/lib";
import {
  ConfirmDialog,
  type ConfirmState,
} from "@/components/staff/ui/confirm-dialog";
import { Drawer } from "@/components/staff/ui/drawer";
import {
  BookingStatusBadge,
  DepartureStatusBadge,
} from "@/components/staff/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/misc";
import { ThemeBenefits } from "@/components/customer/theme-benefits";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import {
  dateTime,
  duration,
  fullDate,
  HOTEL_LABEL,
  MEAL_LABEL,
  shortDate,
  STYLE_LABEL,
  TRANSPORT_LABEL,
  won,
} from "@/lib/format";
import type { Booking } from "@/lib/types";

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-[14px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

export function BookingDrawer({
  booking,
  onClose,
  onUpdated,
}: {
  booking: Booking | null;
  onClose: () => void;
  onUpdated: (b: Booking) => void;
}) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const b = booking;

  const act = (kind: "confirm" | "cancel" | "complete") => {
    if (!b) return;
    const meta = {
      confirm: {
        title: "예약을 수동 확정할까요?",
        description: (
          <>
            보통은 동행 인원이 최소 인원({b.theme.min_travelers}명)에 도달하면
            자동으로 확정됩니다. 현재 {b.travelers_count}명으로{" "}
            {b.needed_more > 0
              ? `${b.needed_more}명이 부족하지만`
              : "인원은 충족했고"}{" "}
            담당자 판단으로 확정 처리합니다. 고객에게 확정 문자가 기록되고 테마
            기본 제공 물품 중 아직 확보하지 않은 수량이 출고됩니다. 재고가 부족하면 확정할 수 없습니다.
          </>
        ),
        confirmLabel: "수동 확정",
        tone: "primary" as const,
        run: () => api.staff.bookings.confirm(b.id),
        done: "예약을 확정했어요",
      },
      cancel: {
        title: "예약을 취소할까요?",
        description: (
          <>
            <b>{b.code}</b> ({b.customer.name}, {b.travelers_count}명) 예약을
            취소합니다. 취소 후에는 되돌릴 수 없어요.
          </>
        ),
        confirmLabel: "예약 취소",
        tone: "danger" as const,
        run: () => api.staff.bookings.cancel(b.id),
        done: "예약을 취소했어요",
      },
      complete: {
        title: "여행 완료로 처리할까요?",
        description: (
          <>
            {shortDate(b.departure.depart_date)} 출발 여행을 완료 처리합니다.
            대표자와 회원 동행의 완료 여행 횟수가 1회씩 늘어나 단골 등급에
            반영됩니다.
          </>
        ),
        confirmLabel: "여행 완료 처리",
        tone: "primary" as const,
        run: () => api.staff.bookings.complete(b.id),
        done: "여행 완료로 처리했어요",
      },
    }[kind];
    setConfirm({
      title: meta.title,
      description: meta.description,
      confirmLabel: meta.confirmLabel,
      tone: meta.tone,
      onConfirm: async () => {
        try {
          const res = await meta.run();
          onUpdated(res);
          toast(meta.done, "success");
        } catch (e) {
          toast(errMsg(e), "error");
        }
      },
    });
  };

  const footer = b ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] text-muted">
        {b.status === "gathering" &&
          "인원 도달 시 자동 확정 · 필요하면 수동 확정"}
        {b.status === "pending" && "고객 결제 대기 중"}
        {b.status === "confirmed" && "출발 후 여행 완료 처리를 해 주세요"}
        {b.status === "completed" && `완료 처리됨`}
        {b.status === "cancelled" && "취소된 예약"}
      </span>
      <div className="flex gap-2">
        {(b.status === "pending" ||
          b.status === "gathering" ||
          b.status === "confirmed") && (
          <Button
            variant="outline"
            size="sm"
            className="text-danger"
            onClick={() => act("cancel")}
          >
            예약 취소
          </Button>
        )}
        {b.status === "gathering" && (
          <Button size="sm" onClick={() => act("confirm")}>
            수동 확정
          </Button>
        )}
        {b.status === "confirmed" && (
          <Button size="sm" onClick={() => act("complete")}>
            여행 완료 처리
          </Button>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <>
      <Drawer
        open={b !== null}
        onClose={onClose}
        title={
          b && (
            <span className="inline-flex items-center gap-2">
              <span className="font-mono">{b.code}</span>
              <BookingStatusBadge status={b.status} />
            </span>
          )
        }
        subtitle={
          b &&
          `생성 ${dateTime(b.created_at)}${b.paid_at ? ` · 결제 ${dateTime(b.paid_at)}` : ""}${b.confirmed_at ? ` · 확정 ${dateTime(b.confirmed_at)}` : ""}`
        }
        footer={footer}
      >
        {b && (
          <div className="space-y-5">
            {/* 상품 */}
            <div className="flex gap-3 rounded-xl border border-line p-3">
              <Photo
                src={b.package.hero_images[0]}
                alt={b.package.title}
                className="h-16 w-24 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted">{b.theme.name}</p>
                <Link
                  href={`/staff/packages/${b.package.id}`}
                  className="line-clamp-1 text-[15px] font-bold text-ink hover:text-primary"
                >
                  {b.package.title}
                </Link>
                <p className="mt-0.5 text-[13px] text-ink-2">
                  {b.package.region} ·{" "}
                  {duration(b.package.nights, b.package.days)} ·{" "}
                  {fullDate(b.departure.depart_date)} ~{" "}
                  {fullDate(b.departure.return_date)}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted">
                  <DepartureStatusBadge status={b.departure.status} />
                  <span className="tabular">
                    출발일정 예약 {b.departure.booked}/{b.departure.capacity}명
                  </span>
                </div>
              </div>
            </div>

            {b.status === "gathering" && (
              <div className="rounded-xl bg-primary-soft px-4 py-3 text-[13px] text-primary-dark">
                동행 모집 중 · 최소 {b.theme.min_travelers}명 중{" "}
                {b.travelers_count}명 신청, <b>{b.needed_more}명</b> 더 필요
                {b.invite_code && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 font-mono text-[12px] font-bold text-primary">
                    <Link2 className="size-3.5" /> {b.invite_code}
                  </span>
                )}
              </div>
            )}

            <Section title="고객">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/staff/customers/${b.customer.id}`}
                    className="text-[15px] font-bold text-ink hover:text-primary"
                  >
                    {b.customer.name}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3.5 text-muted" />{" "}
                      {b.customer.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3.5 text-muted" />{" "}
                      {b.customer.email}
                    </span>
                  </p>
                </div>
              </div>
              {b.memo && (
                <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-[13px] text-ink-2">
                  메모: {b.memo}
                </p>
              )}
            </Section>

            <ThemeBenefits perks={b.theme.perks} transportLabel={TRANSPORT_LABEL[b.transport_code]} travelersCount={b.travelers_count} />

            <Section title={`여행자 ${b.travelers_count}명`}>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {b.travelers.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-[14px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-bg text-muted">
                        <UserRound className="size-4" />
                      </span>
                      <span className="font-semibold text-ink">{t.name}</span>
                      <span className="text-[13px] text-muted">{t.phone}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {t.is_representative && (
                        <Badge tone="info">
                          <Crown className="size-3" /> 대표
                        </Badge>
                      )}
                      {t.joined_via_code && (
                        <Badge tone="success">초대코드 합류</Badge>
                      )}
                      {t.user_id ? (
                        <Badge tone="neutral">회원</Badge>
                      ) : (
                        <Badge tone="muted">비회원</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="옵션">
              <dl>
                <Row
                  label="스타일"
                  value={
                    <span className="font-semibold">
                      {STYLE_LABEL[b.style_code]}
                    </span>
                  }
                />
                <Row label="호텔" value={HOTEL_LABEL(b.hotel_grade)} />
                <Row label="식사" value={MEAL_LABEL[b.meal_code]} />
                <Row label="차량" value={TRANSPORT_LABEL[b.transport_code]} />
                <Row
                  label="추가 옵션"
                  value={
                    b.addons.length ? (
                      <ul className="space-y-0.5">
                        {b.addons.map((a) => (
                          <li key={a.meal_addon_id}>
                            {a.label} × {a.qty}{" "}
                            <span className="text-muted">
                              ({won(a.unit_price)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">없음</span>
                    )
                  }
                />
              </dl>
            </Section>

            <Section title="금액">
              <dl className="rounded-xl bg-bg px-4 py-2">
                {b.quote.lines.map((l, i) => (
                  <Row
                    key={i}
                    label={l.label}
                    value={
                      <span
                        className={
                          l.amount < 0 ? "text-accent tabular" : "tabular"
                        }
                      >
                        {won(l.amount)}
                      </span>
                    }
                  />
                ))}
                <div className="my-1 border-t border-line" />
                <Row
                  label="총액"
                  value={
                    <span className="text-[16px] font-bold tabular">
                      {won(b.quote.total)}
                    </span>
                  }
                />
                <Row
                  label="예약금(10%)"
                  value={
                    <span className="tabular">{won(b.quote.deposit)}</span>
                  }
                />
                {b.quote.discount_rate > 0 && (
                  <Row
                    label="단골 할인율"
                    value={`${Math.round(b.quote.discount_rate * 100)}%`}
                  />
                )}
              </dl>
            </Section>
          </div>
        )}
      </Drawer>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
