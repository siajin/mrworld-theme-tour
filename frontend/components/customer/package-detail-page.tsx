"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { AlertCircle, Check, ChevronRight, Star, Users, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Catalog, Package, Theme } from "@/lib/types";
import { HOTEL_LABEL, MEAL_LABEL, STYLE_LABEL, duration, shortDate, won } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { VoiceButton, useVoiceContext } from "@/components/voice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Accordion, Skeleton } from "@/components/ui/misc";
import { Gallery } from "./gallery";
import { ThemeBenefits } from "./theme-benefits";
import { DepartureChips } from "./departure-chips";
import { StyleSelector } from "./style-selector";
import { OptionEditor } from "./option-editor";
import { Itinerary } from "./itinerary";
import { CountStepper } from "./count-stepper";
import { PriceSummary } from "./price-summary";
import { NotFoundBlock } from "./not-found-block";
import { useQuote } from "./use-quote";
import {
  applyOptionRules,
  bookingHref,
  clamp,
  floorHotelMessage,
  floorMealMessage,
  hotelAllowed,
  initialOptions,
  isHotelGrade,
  isMealCode,
  loginHref,
  maxTravelersFor,
  mealAllowed,
  openDepartures,
  optionFloor,
  ratingText,
  type BookingOptions,
} from "./utils";

type SectionKey = "overview" | "style" | "includes" | "itinerary" | "notes";
const SECTIONS: { value: SectionKey; label: string }[] = [
  { value: "overview", label: "개요" },
  { value: "style", label: "스타일 선택" },
  { value: "includes", label: "포함/불포함" },
  { value: "itinerary", label: "일정표" },
  { value: "notes", label: "유의사항" },
];

const CANCEL_POLICY = [
  ["출발 30일 전까지", "예약금 전액 환불"],
  ["출발 29~15일 전", "여행 요금의 10% 공제"],
  ["출발 14~8일 전", "여행 요금의 20% 공제"],
  ["출발 7일 전~당일", "여행 요금의 30% 공제"],
];

export function PackageDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [pkg, setPkg] = useState<Package | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [tab, setTab] = useState<SectionKey>("overview");
  // 음성으로 호텔/식사를 바꾸면 "세부 변경" 아코디언을 펼쳐서 보여 준다 (key 를 올려 defaultOpen 으로 다시 마운트)
  const [detailsOpenKey, setDetailsOpenKey] = useState(0);

  // ── 데이터 로드
  useEffect(() => {
    let alive = true;
    Promise.all([api.packages.get(id), api.catalog()])
      .then(async ([p, c]) => {
        if (!alive) return;
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
        setOptions(initialOptions(p, t, c));
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
  }, [id, toast]);

  const { quote, loading: quoting, error: quoteError } = useQuote(pkg?.id ?? null, options, user?.id ?? 0);

  const departures = useMemo(() => (pkg ? openDepartures(pkg.departures) : []), [pkg]);
  const selectedDep = departures.find((d) => d.id === options?.departureId) ?? null;
  const minTravelers = theme?.min_travelers ?? 3;

  const floor = useMemo(() => (catalog ? optionFloor(catalog, pkg ?? null, theme) : null), [catalog, pkg, theme]);

  // 옵션 변경은 전부 여기를 거친다: 스타일 변경 시 호텔·식사 초기화, 테마 하한, 잔여 인원, 차량 정원 규칙을 적용하고
  // 자동으로 바뀐 항목은 토스트로 이유를 알려 준다 (백엔드 400 과 같은 규칙이라 잘못된 견적 요청을 보내지 않는다)
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

  // ── 섹션 스크롤 스파이
  useEffect(() => {
    const onScroll = () => {
      const offset = 130;
      let current: SectionKey = "overview";
      for (const s of SECTIONS) {
        const el = document.getElementById(`sec-${s.value}`);
        if (el && el.getBoundingClientRect().top - offset <= 0) current = s.value;
      }
      setTab(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pkg]);

  const scrollTo = (k: SectionKey) => {
    setTab(k);
    document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── 예약하기
  const onBook = () => {
    if (!pkg || !options?.departureId) {
      toast(departures.every((d) => d.remaining <= 0) ? "예약 가능한 출발일정이 없어요" : "출발일을 먼저 선택해 주세요");
      return;
    }
    const href = bookingHref(pkg.id, options);
    if (!user) {
      toast("로그인 후 예약할 수 있어요");
      router.push(loginHref(href));
      return;
    }
    router.push(href);
  };

  // ── 음성 명령 (context: package) ─────────────────────────────
  useVoiceContext("package", (r) => {
    if (!pkg || !catalog || !options) return false;
    const themeShort = pkg.theme.name.replace(/ 투어$/, "");

    switch (r.intent) {
      case "set_style": {
        const code = r.style_code;
        if (!code) return false;
        const sp = pkg.style_prices.find((x) => x.style_code === code);
        if (!sp || !sp.available) {
          const minAllowed = pkg.style_prices.find((x) => x.available)?.style_code ?? "grand";
          toast(`${themeShort} 테마는 ${STYLE_LABEL[minAllowed]} 스타일 이상만 선택할 수 있어요`, "error");
          return true;
        }
        update({ style: code });
        scrollTo("style");
        toast(`${STYLE_LABEL[code]} 스타일로 바꿨어요`, "success");
        return true;
      }
      case "set_travelers": {
        const n = r.travelers_count;
        if (!n) return false;
        const v = clamp(n, 1, maxTravelersFor(selectedDep, theme ?? pkg?.theme));
        // 차량 정원을 넘으면 update 가 인원에 맞는 차량으로 바꾸고 그 이유를 토스트로 알린다
        update({ travelers: v });
        toast(v === n ? `인원을 ${v}명으로 바꿨어요` : `잔여 인원에 맞춰 ${v}명으로 바꿨어요`, "success");
        return true;
      }
      case "set_departure": {
        if (departures.length === 0) {
          toast("현재 예약 가능한 출발일이 없어요", "error");
          return true;
        }
        let dep = null as (typeof departures)[number] | null;
        if (r.slots.depart_date) {
          dep = departures.find((d) => d.depart_date === r.slots.depart_date) ?? null;
          if (!dep) {
            toast("해당 날짜 출발 일정이 없어요", "error");
            return true;
          }
        } else if (r.slots.departure_pick === "last") {
          dep = departures[departures.length - 1];
        } else if (r.slots.departure_pick === "next") {
          const i = departures.findIndex((d) => d.id === options.departureId);
          dep = departures[i + 1] ?? null;
          if (!dep) {
            toast("이후 출발 일정이 없어요");
            return true;
          }
        } else {
          dep = departures[0];
        }
        update({ departureId: dep.id });
        toast(`${shortDate(dep.depart_date)} 출발로 바꿨어요`, "success");
        return true;
      }
      case "set_hotel": {
        const g = r.slots.hotel_grade ?? 0;
        if (!isHotelGrade(g)) return false;
        if (floor && !hotelAllowed(g, floor)) {
          toast(floorHotelMessage(theme, floor), "error");
          setDetailsOpenKey((k) => k + 1);
          scrollTo("style");
          return true;
        }
        update({ hotel: g });
        setDetailsOpenKey((k) => k + 1);
        scrollTo("style");
        toast(`호텔을 ${HOTEL_LABEL(g)}으로 바꿨어요`, "success");
        return true;
      }
      case "set_meal": {
        const m = r.slots.meal_code;
        if (!isMealCode(m)) return false;
        if (floor && !mealAllowed(m, floor)) {
          toast(floorMealMessage(catalog, theme, floor), "error");
          setDetailsOpenKey((k) => k + 1);
          scrollTo("style");
          return true;
        }
        update({ meal: m });
        setDetailsOpenKey((k) => k + 1);
        scrollTo("style");
        toast(`식사를 ${catalog.meal_options.find((x) => x.code === m)?.label ?? MEAL_LABEL[m]}(으)로 바꿨어요`, "success");
        return true;
      }
      case "book":
        onBook();
        return true;
      default:
        return false;
    }
  });

  if (pkg === null) {
    return <NotFoundBlock title="상품을 찾을 수 없어요" description="판매가 종료되었거나 주소가 잘못된 상품이에요." />;
  }

  if (pkg === undefined || !catalog || !options) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 pt-0 md:pt-6" aria-busy="true">
        <Skeleton className="-mx-4 aspect-[16/10] rounded-none md:mx-0 md:aspect-[21/9] md:rounded-[var(--radius-card)]" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] w-[112px] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const confirmed = selectedDep ? selectedDep.booked >= minTravelers : false;
  const transportLabel = catalog.transport_options.find((t) => t.code === options.transport)?.label ?? "";
  const mealLabel = catalog.meal_options.find((m) => m.code === options.meal)?.label ?? MEAL_LABEL[options.meal];
  const bookHref = options.departureId ? bookingHref(pkg.id, options) : null;
  const maxTravelers = maxTravelersFor(selectedDep, theme ?? pkg?.theme);
  const noDeparture = departures.every((d) => d.remaining <= 0);

  const sectionCls = "scroll-mt-[112px] md:scroll-mt-[120px]";

  return (
    <>
      <div className="mx-auto max-w-[1120px] md:px-4 md:pt-6">
        {/* 경로 */}
        <nav aria-label="현재 위치" className="hidden items-center gap-1 pb-3 text-[13px] text-muted md:flex">
          <Link href="/" className="hover:text-ink">
            홈
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <Link href={`/themes/${pkg.theme.slug}`} className="hover:text-ink">
            {pkg.theme.name}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="text-ink-2">{pkg.region}</span>
        </nav>

        <Gallery images={pkg.hero_images} alt={pkg.title} className="aspect-[16/10] md:aspect-[21/9]" />
      </div>

      <div className="mx-auto max-w-[1120px] px-4">
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-10">
          {/* ── 왼쪽: 본문 ─────────────────────────────────── */}
          <div className="min-w-0">
            <header className="pt-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={confirmed ? "success" : "info"}>{confirmed ? "출발 확정" : "동행 모집 중"}</Badge>
                {pkg.badges.map((b) => (
                  <Badge key={b} tone="neutral">
                    {b}
                  </Badge>
                ))}
                <span className="ml-auto text-[12px] tabular text-muted-2">상품번호 MW-P-{String(pkg.id).padStart(4, "0")}</span>
              </div>
              <p className="mt-3 text-[13px] text-muted">
                <Link href={`/themes/${pkg.theme.slug}`} className="font-semibold text-primary hover:underline">
                  {pkg.theme.name}
                </Link>
                <span aria-hidden> · </span>
                {pkg.region}, {pkg.country} · 인천 출발
              </p>
              <h1 className="mt-1 text-[24px] font-bold leading-tight text-ink md:text-[30px]">{pkg.title}</h1>
              <p className="mt-1.5 text-[15px] text-ink-2">{pkg.subtitle}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px]">
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <Star className="size-4 fill-[#f5b301] text-[#f5b301]" aria-hidden />
                  <span className="tabular">{ratingText(pkg.rating, pkg.review_count)}</span>
                </span>
                {selectedDep && (
                  <span className="inline-flex items-center gap-1.5 text-ink-2">
                    <Users className="size-4 text-muted" aria-hidden />
                    <span className="tabular">
                      예약 {selectedDep.booked}명 / 잔여 {selectedDep.remaining}명
                    </span>
                    <span className="text-muted">(최소출발 {minTravelers}명)</span>
                  </span>
                )}
              </div>
            </header>

            {/* 출발일 · 인원 */}
            <section className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-4 md:p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[16px] font-bold text-ink">출발일 선택</h2>
                <span className="text-[12px] text-muted">모집 중인 일정만 표시</span>
              </div>
              <DepartureChips
                className="mt-3"
                departures={departures}
                value={options.departureId}
                onChange={(d) => update({ departureId: d })}
                minTravelers={minTravelers}
              />
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <div>
                  <p className="text-[15px] font-bold text-ink">여행 인원</p>
                  <p className="text-[12px] text-muted">
                    {options.travelers < minTravelers
                      ? `${minTravelers}명 미만이면 예약 후 동행을 초대해 채울 수 있어요`
                      : `최소 출발 인원 ${minTravelers}명을 충족해요`}
                  </p>
                </div>
                <CountStepper value={options.travelers} onChange={(v) => update({ travelers: v })} min={1} max={maxTravelers} label="여행 인원" />
              </div>
            </section>

            {/* 요약 태그 */}
            <ul className="mt-4 flex flex-wrap gap-2 text-[13px]" aria-label="선택 요약">
              {[duration(pkg.nights, pkg.days), HOTEL_LABEL(options.hotel), transportLabel, mealLabel, `${STYLE_LABEL[options.style]} 스타일`].map((t) => (
                <li key={t} className="rounded-full border border-line bg-surface px-3 py-1.5 font-semibold text-ink-2">
                  {t}
                </li>
              ))}
            </ul>

            {/* sticky 섹션 탭 */}
            <Tabs<SectionKey> items={SECTIONS} value={tab} onChange={scrollTo} sticky className="mt-6 -mx-4 px-4 md:mx-0 md:px-0" />

            {/* 개요 */}
            <section id="sec-overview" className={clsx(sectionCls, "pt-8")}>
              <h2 className="text-[20px] font-bold text-ink">개요</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{pkg.summary}</p>
              {pkg.highlights.length > 0 && (
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {pkg.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 rounded-[var(--radius-input)] bg-surface border border-line px-3.5 py-3 text-[14px] text-ink-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              {theme && (
                <div className="mt-5">
                  <ThemeBenefits perks={theme.perks} transportLabel={transportLabel} travelersCount={options.travelers} />
                </div>
              )}
            </section>

            {/* 스타일 선택 */}
            <section id="sec-style" className={clsx(sectionCls, "pt-10")}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[20px] font-bold text-ink">스타일 선택</h2>
                <span className="text-[12px] text-muted">성인 1인 기준</span>
              </div>
              <StyleSelector className="mt-4" pkg={pkg} catalog={catalog} value={options.style} onChange={(s) => update({ style: s })} themeName={pkg.theme.name} />
              <OptionEditor
                key={detailsOpenKey}
                defaultOpen={detailsOpenKey > 0}
                className="mt-3"
                catalog={catalog}
                pkg={pkg}
                theme={theme}
                nights={pkg.nights}
                days={pkg.days}
                options={options}
                onChange={update}
              />
            </section>

            {/* 포함/불포함 */}
            <section id="sec-includes" className={clsx(sectionCls, "pt-10")}>
              <h2 className="text-[20px] font-bold text-ink">포함 / 불포함</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <h3 className="text-[15px] font-bold text-success">포함 사항</h3>
                  <ul className="mt-3 space-y-2 text-[14px] text-ink-2">
                    {pkg.includes.map((s) => (
                      <li key={s} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <h3 className="text-[15px] font-bold text-danger">불포함 사항</h3>
                  <ul className="mt-3 space-y-2 text-[14px] text-ink-2">
                    {pkg.excludes.map((s) => (
                      <li key={s} className="flex items-start gap-2">
                        <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* 일정표 */}
            <section id="sec-itinerary" className={clsx(sectionCls, "pt-10")}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[20px] font-bold text-ink">일정표</h2>
                <span className="text-[12px] text-muted">{duration(pkg.nights, pkg.days)} · 현지 사정에 따라 순서가 바뀔 수 있어요</span>
              </div>
              <Itinerary className="mt-4" days={pkg.itinerary} />
            </section>

            {/* 유의사항 */}
            <section id="sec-notes" className={clsx(sectionCls, "pt-10 pb-10")}>
              <h2 className="text-[20px] font-bold text-ink">유의사항</h2>
              {pkg.notes && (
                <div className="mt-4 flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-[14px] leading-relaxed text-ink-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <p>{pkg.notes}</p>
                </div>
              )}
              <div className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface px-5">
                <Accordion title="취소 · 환불 규정">
                  <table className="w-full text-[14px]">
                    <tbody>
                      {CANCEL_POLICY.map(([when, fee]) => (
                        <tr key={when} className="border-b border-line last:border-b-0">
                          <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink-2">
                            {when}
                          </th>
                          <td className="py-2 text-right text-ink">{fee}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-[13px] text-muted">
                    국외여행 표준약관 기준이며, 항공권 발권 이후에는 항공사 규정에 따른 취소 수수료가 추가될 수 있습니다.
                  </p>
                </Accordion>
                <Accordion title="최소 출발 인원 미달 시 규정">
                  <p>
                    이 상품은 예약 1건의 인원이 <b className="text-ink">{minTravelers}명</b> 이상이면 출발이 확정됩니다. 인원이 부족하면
                    예약금 결제 후 <b className="text-ink">동행 모집 중</b> 상태가 되며, 발급된 초대 코드로 가족·친구를 초대하거나 마이페이지에서
                    직접 동행을 추가해 인원을 채울 수 있습니다. 인원이 채워지는 즉시 확정 문자를 보내드립니다.
                  </p>
                  <p className="mt-2">
                    출발 7일 전까지 인원이 모이지 않으면 회사가 예약을 취소하고 예약금을 전액 환불합니다. 다른 고객과 인원을 합산하지는 않습니다.
                  </p>
                </Accordion>
                <Accordion title="여행 준비 안내" className="border-b-0">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>여권 유효기간이 출발일 기준 6개월 이상 남아 있어야 합니다.</li>
                    <li>기념품은 여행 안내에 따라 전달하고, 테마 연출·체험 서비스는 일정 중 제공됩니다.</li>
                    <li>식사 추가옵션은 출발 3일 전까지 변경할 수 있습니다.</li>
                  </ul>
                </Accordion>
              </div>
            </section>
          </div>

          {/* ── 오른쪽: 데스크톱 예약 패널 ───────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="text-[12px] font-semibold text-muted">선택한 조건</p>
              <dl className="mt-2 space-y-1.5 text-[14px]">
                <div className="flex justify-between">
                  <dt className="text-muted">출발일</dt>
                  <dd className="font-semibold tabular text-ink">
                    {selectedDep ? `${selectedDep.depart_date.replace(/-/g, ".")} ~ ${selectedDep.return_date.slice(5).replace("-", ".")}` : "선택 안 됨"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">스타일</dt>
                  <dd className="font-semibold text-ink">
                    {STYLE_LABEL[options.style]} · {HOTEL_LABEL(options.hotel)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">인원</dt>
                  <dd className="font-semibold tabular text-ink">{options.travelers}명</dd>
                </div>
              </dl>
              <div className="my-4 border-t border-line" />
              {noDeparture ? (
                <p className="flex items-start gap-2 rounded-[var(--radius-input)] bg-bg px-3 py-2.5 text-[13px] text-muted">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  예약 가능한 출발일정이 없어요
                </p>
              ) : quoteError ? (
                <p className="flex items-start gap-2 rounded-[var(--radius-input)] bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {quoteError}
                </p>
              ) : (
                <PriceSummary quote={quote} loading={quoting} compact />
              )}
              <Button size="lg" full className="mt-4" onClick={onBook} disabled={!bookHref || !!quoteError} aria-label="예약하기">
                예약하기
              </Button>
              <p className="mt-2 text-center text-[12px] text-muted">예약금만 결제 · 잔금은 출발 7일 전까지</p>
              <p className="mt-3 border-t border-line pt-3 text-center text-[12px] leading-relaxed text-muted-2">
                말로도 바꿀 수 있어요: “그랜드로”, “3명으로”, “예약해줘”
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* ── 모바일/태블릿 하단 고정 예약 바 ─────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="safe-bottom mx-auto flex max-w-[1120px] items-center gap-3 px-4 pt-3">
          <VoiceButton className="-ml-1" />
          <div className="min-w-0 flex-1">
            {quoteError ? (
              <p className="truncate text-[13px] font-semibold text-danger">{quoteError}</p>
            ) : quote ? (
              <>
                <p className={clsx("text-[18px] font-bold tabular text-ink", quoting && "opacity-60")}>총 {won(quote.total)}</p>
                <p className="text-[12px] tabular text-muted">
                  예약금 {won(quote.deposit)} · {quote.travelers_count}명
                </p>
              </>
            ) : options.departureId ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              <p className="text-[14px] font-semibold text-ink-2">{noDeparture ? "예약 가능한 출발일정이 없어요" : "출발일을 선택해 주세요"}</p>
            )}
          </div>
          <Button size="lg" className="min-w-[132px]" onClick={onBook} disabled={!bookHref || !!quoteError} aria-label="예약하기">
            예약하기
          </Button>
        </div>
      </div>
      {/* 하단 바 높이만큼 여백 — 모바일(<md)은 셸의 하단 여백을 그대로 쓰고, 태블릿 구간만 추가 */}
      <div className="hidden h-[84px] md:block lg:hidden" aria-hidden />
    </>
  );
}
