"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { AlertCircle, ChevronDown, ChevronLeft, CreditCard, Landmark, Users, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Catalog, Package, Theme } from "@/lib/types";
import { HOTEL_LABEL, STYLE_LABEL, TRANSPORT_LABEL, duration, fullDate, shortDate, won } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Photo, Skeleton, Stepper } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { DepartureChips } from "./departure-chips";
import { CountStepper } from "./count-stepper";
import { StyleSelector } from "./style-selector";
import { ThemeBenefits } from "./theme-benefits";
import { OptionEditor } from "./option-editor";
import { PriceSummary } from "./price-summary";
import { NotFoundBlock } from "./not-found-block";
import { TravelerForm, emptyTraveler, toTravelerIn, travelerValid, type TravelerDraft } from "./traveler-form";
import { useQuote, toQuoteRequest } from "./use-quote";
import { useVoiceContext } from "@/components/voice";
import { applyOptionRules, clamp, loginHref, maxTravelersFor, openDepartures, optionsFromParams, type BookingOptions } from "./utils";

const STEPS = ["출발일·인원 확인", "스타일·옵션 확인", "여행자 정보", "결제"];

export function BookingFlow({ packageId }: { packageId: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const { user, loading: authLoading } = useAuth();

  const [pkg, setPkg] = useState<Package | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [step, setStep] = useState(0);
  const [travelers, setTravelers] = useState<TravelerDraft[]>([]);
  const [method, setMethod] = useState<"card" | "transfer">("card");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const paymentInFlight = useRef(false);
  const pendingPayment = useRef<{ signature: string; id: number } | null>(null);

  // ── 로그인 필수
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(loginHref(`${window.location.pathname}${window.location.search}`));
    }
  }, [authLoading, user, router]);

  // ── 데이터 로드 + URL 옵션 복원
  useEffect(() => {
    let alive = true;
    Promise.all([api.packages.get(packageId), api.catalog()])
      .then(async ([p, c]) => {
        let t: Theme | null = null;
        try {
          t = await api.themes.get(p.theme.slug);
        } catch {
          t = null;
        }
        if (!alive) return;
        setPkg(p);
        setCatalog(c);
        setTheme(t);
        setOptions(optionsFromParams(new URLSearchParams(sp.toString()), p, t, c));
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) setPkg(null);
        else {
          toast(err instanceof Error ? err.message : "상품을 불러오지 못했어요", "error");
          setPkg(null);
        }
      });
    return () => {
      alive = false;
    };
    // sp 는 최초 진입 시 한 번만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, toast]);

  const { quote, loading: quoting, error: quoteError } = useQuote(pkg?.id ?? null, options, user?.id ?? 0);
  const departures = useMemo(() => (pkg ? openDepartures(pkg.departures) : []), [pkg]);
  const selectedDep = departures.find((d) => d.id === options?.departureId) ?? null;
  const minTravelers = theme?.min_travelers ?? 3;

  // 상세 페이지와 같은 규칙 엔진: 스타일 변경 시 호텔·식사 초기화, 테마 하한, 잔여 인원, 차량 정원
  const update = useCallback(
    (patch: Partial<BookingOptions>) => {
      if (!options || !catalog || !pkg) return;
      const dep = departures.find((d) => d.id === (patch.departureId ?? options.departureId)) ?? null;
      const { options: next, adjustments } = applyOptionRules(catalog, pkg, theme, options, patch, dep);
      setOptions(next);
      adjustments.forEach((a) => toast(a.message, a.tone));
    },
    [options, catalog, pkg, theme, departures, toast],
  );

  // 음성: 1단계에서 "3명으로" 만 지원 (나머지 화면 조작은 상세에서)
  useVoiceContext("booking", (r) => {
    if (r.intent === "set_travelers" && step === 0 && r.travelers_count) {
      const n = clamp(r.travelers_count, 1, maxTravelersFor(selectedDep, theme ?? pkg?.theme));
      update({ travelers: n });
      toast(n === r.travelers_count ? `인원을 ${n}명으로 바꿨어요` : `잔여 인원에 맞춰 ${n}명으로 바꿨어요`, "success");
      return true;
    }
    return false;
  });

  // 여행자 폼 개수를 인원과 맞춘다 (대표자는 사용자 정보로 미리 채움) — 렌더 시 파생
  const travelerRows = useMemo<TravelerDraft[]>(() => {
    const n = options?.travelers ?? 0;
    const rows = [...travelers];
    if (rows.length === 0) rows.push({ name: user?.name ?? "", phone: user?.phone ?? "", birth: "", is_representative: true });
    while (rows.length < n) rows.push(emptyTraveler(false));
    return rows.slice(0, n);
  }, [travelers, options?.travelers, user]);

  // 견적이 아직 안 왔거나(옛 가격) 백엔드가 거절한 옵션으로는 다음 단계·결제로 넘어가지 않는다
  const canNext = (() => {
    if (!options) return false;
    if (step === 0) return !!options.departureId && options.travelers >= 1 && !quoteError && !quoting;
    if (step === 1) return !!quote && !quoteError && !quoting;
    if (step === 2) return travelerRows.length === options.travelers && travelerRows.every(travelerValid);
    return agree && !!quote && !quoteError && !quoting;
  })();

  const pay = async () => {
    if (!pkg || !options || !quote || !canNext || paymentInFlight.current) return;
    const req = toQuoteRequest(pkg.id, options);
    if (!req) return;
    paymentInFlight.current = true;
    setSubmitting(true);
    try {
      const payload = { ...req, travelers: travelerRows.map(toTravelerIn) };
      const signature = JSON.stringify(payload);
      if (pendingPayment.current && pendingPayment.current.signature !== signature) {
        // Editing after a failed payment replaces the unfinished booking rather
        // than leaving an invisible extra reservation in the customer's list.
        await api.bookings.cancel(pendingPayment.current.id);
        pendingPayment.current = null;
      }
      if (!pendingPayment.current) {
        const created = await api.bookings.create(payload);
        pendingPayment.current = { signature, id: created.id };
      }
      const id = pendingPayment.current.id;
      const paid = await api.bookings.pay(id, method).catch(async (error: unknown) => {
        // The payment may have committed even if its response was interrupted.
        // Recover that result before letting the customer retry the same booking.
        try {
          const saved = await api.bookings.get(id);
          if (saved.paid_at && (saved.status === "confirmed" || saved.status === "gathering")) return saved;
        } catch {
          // Keep the original payment error and the pending ID for retry.
        }
        throw error;
      });
      toast(paid.status === "confirmed" ? "결제가 완료되어 출발이 확정되었어요" : "예약금 결제가 완료되었어요", "success");
      router.push(`/booking/complete/${paid.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "결제에 실패했어요", "error");
      setSubmitting(false);
    } finally {
      paymentInFlight.current = false;
    }
  };

  if (pkg === null) {
    return <NotFoundBlock title="예약할 상품을 찾을 수 없어요" description="상품이 판매 종료되었거나 주소가 잘못되었어요." />;
  }

  if (pkg === undefined || !catalog || !options || authLoading || !user) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-8" aria-busy="true">
        <Skeleton className="h-6 w-64" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-[320px] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-[280px] w-full rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  const gathering = options.travelers < minTravelers;
  const maxTravelers = maxTravelersFor(selectedDep, theme ?? pkg?.theme);

  const SummaryCard = (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
      <div className="flex gap-3">
        <Photo src={pkg.hero_images[0]} alt={pkg.title} className="size-[72px] shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[12px] text-muted">
            {pkg.theme.name} · {pkg.region}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-ink">{pkg.title}</p>
          <p className="mt-1 text-[12px] tabular text-muted">
            {duration(pkg.nights, pkg.days)} · {selectedDep ? `${shortDate(selectedDep.depart_date)} 출발` : "출발일 미선택"}
          </p>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13.5px]">
        <div className="flex justify-between">
          <dt className="text-muted">스타일</dt>
          <dd className="font-semibold text-ink">
            {STYLE_LABEL[options.style]} · {HOTEL_LABEL(options.hotel)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">식사 · 교통</dt>
          <dd className="text-right font-semibold text-ink">
            {catalog.meal_options.find((m) => m.code === options.meal)?.label}
            <br />
            <span className="text-[12px] font-medium text-ink-2">{catalog.transport_options.find((t) => t.code === options.transport)?.label}</span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">인원</dt>
          <dd className="font-semibold tabular text-ink">
            {options.travelers}명
            <span className="ml-1 text-[12px] font-medium text-muted">(최소 {minTravelers}명)</span>
          </dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-line pt-4">
        {quoteError ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-input)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {quoteError}
          </p>
        ) : (
          <PriceSummary quote={quote} loading={quoting} compact />
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-32 pt-5 md:pb-16 md:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/packages/${pkg.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> 상품 상세로
        </Link>
        <Stepper steps={STEPS} current={step} />
      </div>
      <h1 className="mt-4 text-[22px] font-bold text-ink md:text-[26px]">
        <span className="mr-2 text-primary tabular">{step + 1}.</span>
        {STEPS[step]}
      </h1>

      {/* 모바일: 접이식 요약 카드 */}
      <div className="mt-4 lg:hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((v) => !v)}
          aria-expanded={summaryOpen}
          className="flex w-full items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold text-ink">{pkg.title}</span>
            <span className="block text-[12px] tabular text-muted">
              {selectedDep ? `${shortDate(selectedDep.depart_date)} 출발 · ` : ""}
              {options.travelers}명 · {STYLE_LABEL[options.style]}
            </span>
          </span>
          <span className="ml-3 flex shrink-0 items-center gap-2">
            <span className="text-[16px] font-bold tabular text-ink">{quote ? won(quote.total) : "-"}</span>
            <ChevronDown className={clsx("size-5 text-muted transition-transform", summaryOpen && "rotate-180")} aria-hidden />
          </span>
        </button>
        {summaryOpen && <div className="mt-2">{SummaryCard}</div>}
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_360px] lg:gap-10">
        <div className="min-w-0 space-y-5">
          {/* STEP 1 */}
          {step === 0 && (
            <>
              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
                <h2 className="text-[16px] font-bold text-ink">출발일</h2>
                <DepartureChips className="mt-3" departures={departures} value={options.departureId} onChange={(d) => update({ departureId: d })} minTravelers={minTravelers} />
                {selectedDep && (
                  <p className="mt-3 text-[13px] tabular text-muted">
                    {fullDate(selectedDep.depart_date)} 출발 ~ {fullDate(selectedDep.return_date)} 도착 · 예약 {selectedDep.booked}명 / 잔여 {selectedDep.remaining}명
                  </p>
                )}
              </section>
              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-ink">여행 인원</h2>
                    <p className="mt-0.5 text-[13px] text-muted">대표자 본인을 포함한 총 인원</p>
                  </div>
                  <CountStepper value={options.travelers} onChange={(v) => update({ travelers: v })} min={1} max={maxTravelers} label="여행 인원" />
                </div>
                <div className={clsx("mt-4 flex items-start gap-2.5 rounded-[var(--radius-input)] px-3.5 py-3 text-[13.5px]", gathering ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}>
                  <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {gathering ? (
                    <p>
                      최소 출발 인원 {minTravelers}명보다 {minTravelers - options.travelers}명 부족해요. 결제 후 <b>동행 모집 중</b> 상태가 되며, 초대 코드로 동행이 합류하면
                      바로 출발이 확정됩니다.
                    </p>
                  ) : (
                    <p>최소 출발 인원 {minTravelers}명을 충족해요. 예약금 결제와 함께 출발이 확정됩니다.</p>
                  )}
                </div>
              </section>
            </>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <>
              <section>
                <h2 className="text-[16px] font-bold text-ink">스타일</h2>
                <StyleSelector className="mt-3" pkg={pkg} catalog={catalog} value={options.style} onChange={(s) => update({ style: s })} themeName={pkg.theme.name} />
              </section>
              <OptionEditor catalog={catalog} pkg={pkg} theme={theme} nights={pkg.nights} days={pkg.days} options={options} onChange={update} defaultOpen />
            </>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <>
              <p className="rounded-[var(--radius-input)] bg-primary-soft px-4 py-3 text-[13.5px] text-primary-dark">
                함께 가는 분들의 정보를 입력하세요. 지금 모르는 분은 인원을 줄이고 나중에 초대 코드로 합류시킬 수도 있어요.
              </p>
              {travelerRows.map((t, i) => (
                <TravelerForm
                  key={i}
                  index={i}
                  value={t}
                  onChange={(v) => setTravelers(travelerRows.map((x, j) => (j === i ? v : x)))}
                  onRemove={
                    i === 0
                      ? undefined
                      : () => {
                          // 해당 동행 폼만 빼고 인원을 1 줄인다 (가격·차량은 update 가 다시 계산)
                          setTravelers(travelerRows.filter((_, j) => j !== i));
                          update({ travelers: options.travelers - 1 });
                        }
                  }
                />
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="md"
                  disabled={options.travelers >= maxTravelers}
                  onClick={() => {
                    setTravelers([...travelerRows, emptyTraveler(false)]);
                    update({ travelers: options.travelers + 1 });
                  }}
                  aria-label="동행 추가"
                >
                  <Plus className="size-4" aria-hidden /> 동행 추가
                </Button>
                <span className="text-[13px] text-muted">
                  현재 {options.travelers}명
                  {options.travelers >= maxTravelers ? ` · 이 출발일정은 최대 ${maxTravelers}명까지 예약할 수 있어요` : ` · 최대 ${maxTravelers}명`}
                </span>
              </div>
            </>
          )}

          {/* STEP 4 */}
          {step === 3 && (
            <>
              {theme && <ThemeBenefits perks={theme.perks} transportLabel={TRANSPORT_LABEL[options.transport]} travelersCount={options.travelers} />}
              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
                <h2 className="text-[16px] font-bold text-ink">결제 금액</h2>
                <div className="mt-3">
                  {quoteError ? (
                    <p className="text-[13px] text-danger">{quoteError}</p>
                  ) : (
                    <PriceSummary quote={quote} loading={quoting} />
                  )}
                </div>
                {quote && quote.discount > 0 && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1 text-[12.5px] font-semibold text-primary">
                    <Badge tone="info">단골 할인</Badge>
                    {user.loyalty ? `${user.loyalty.tier === "gold" ? "골드" : "실버"} 등급 ${Math.round(quote.discount_rate * 100)}% 적용` : "적용"}
                  </p>
                )}
              </section>

              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
                <h2 className="text-[16px] font-bold text-ink">결제 수단</h2>
                <p className="mt-0.5 text-[13px] text-muted">지금은 예약금 {quote ? won(quote.deposit) : ""}만 결제합니다. 잔금은 출발 7일 전까지 안내 문자에 따라 납부해 주세요.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="결제 수단">
                  {(
                    [
                      { v: "card", label: "신용·체크카드", desc: "국내 모든 카드 · 즉시 승인", icon: CreditCard },
                      { v: "transfer", label: "계좌이체", desc: "실시간 계좌이체 · 현금영수증 발급", icon: Landmark },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      role="radio"
                      aria-checked={method === m.v}
                      onClick={() => setMethod(m.v)}
                      className={clsx(
                        "flex items-center gap-3 rounded-[var(--radius-input)] border px-4 py-3 text-left transition-colors",
                        method === m.v ? "border-primary bg-primary-soft/60 ring-1 ring-primary" : "border-line bg-surface hover:border-ink-2",
                      )}
                    >
                      <m.icon className={clsx("size-5 shrink-0", method === m.v ? "text-primary" : "text-muted")} aria-hidden />
                      <span>
                        <span className="block text-[14.5px] font-bold text-ink">{m.label}</span>
                        <span className="block text-[12px] text-muted">{m.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
                <Checkbox
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  label={
                    <span>
                      <span className="text-danger">(필수)</span> 여행 약관, 취소·환불 규정, 최소 출발 인원 미달 시 규정을 확인했으며 이에 동의합니다.
                    </span>
                  }
                />
                <p className="mt-2 pl-7 text-[12px] leading-relaxed text-muted">
                  결제는 시뮬레이션으로 처리되며 실제 청구되지 않습니다. 출발 30일 전까지 취소 시 예약금은 전액 환불됩니다.
                </p>
              </section>
            </>
          )}

          {/* 이동 버튼: 모바일은 하단 고정, 데스크톱은 왼쪽 칼럼 아래 */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:static md:border-0 md:bg-transparent md:pt-2 md:backdrop-blur-0">
            <div className="safe-bottom flex items-center gap-3 px-4 pt-3 md:px-0 md:pt-0">
              {step > 0 && (
                <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} aria-label="이전 단계" disabled={submitting}>
                  이전
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button size="lg" full onClick={() => setStep((s) => s + 1)} disabled={!canNext} aria-label="다음 단계">
                  다음
                </Button>
              ) : (
                <Button size="lg" full onClick={pay} disabled={!canNext} loading={submitting} aria-label="결제하기">
                  {quote ? `예약금 ${won(quote.deposit)} 결제하기` : "결제하기"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-[88px]">{SummaryCard}</div>
        </aside>
      </div>

    </div>
  );
}
