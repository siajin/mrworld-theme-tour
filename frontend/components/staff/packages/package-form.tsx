"use client";

import {
  ArrowDown,
  ArrowUp,
  Check as CheckIcon,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { errMsg } from "@/components/staff/lib";
import {
  ConfirmDialog,
  type ConfirmState,
} from "@/components/staff/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/staff/ui/data-table";
import { FieldGroup } from "@/components/staff/ui/field-group";
import { ImageListEditor } from "@/components/staff/ui/image-list";
import { PageHeader } from "@/components/staff/ui/page-header";
import {
  DepartureStatusBadge,
  PublishedBadge,
} from "@/components/staff/ui/status-badge";
import { StringListEditor } from "@/components/staff/ui/string-list";
import { Switch } from "@/components/staff/ui/switch";
import { TagInput } from "@/components/staff/ui/tag-input";
import { useLoad } from "@/components/staff/use-load";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { shortDate, STYLE_DESC, STYLE_LABEL, won } from "@/lib/format";
import type {
  Departure,
  ItineraryDay,
  Package,
  PackageIn,
  StyleCode,
} from "@/lib/types";
import { DepartureModal, type DepartureModalState } from "./departure-modal";

export type TabKey =
  "basic" | "prices" | "itinerary" | "includes" | "departures" | "publish";
const STYLES: { code: StyleCode; rank: number }[] = [
  { code: "classic", rank: 1 },
  { code: "grand", rank: 2 },
  { code: "premium", rank: 3 },
];

interface FormState {
  theme_id: number | null;
  title: string;
  subtitle: string;
  region: string;
  country: string;
  nights: string;
  days: string;
  summary: string;
  notes: string;
  badges: string[];
  hero_images: string[];
  highlights: string[];
  includes: string[];
  excludes: string[];
  prices: Record<StyleCode, string>;
  itinerary: ItineraryDay[];
  is_published: boolean;
  rating: string;
  review_count: string;
}

const emptyDay = (n: number): ItineraryDay => ({
  day_no: n,
  title: "",
  places: [],
  meals: { breakfast: "", lunch: "", dinner: "" },
  lodging: "",
  description: "",
});

function toForm(p?: Package): FormState {
  const prices: Record<StyleCode, string> = {
    classic: "",
    grand: "",
    premium: "",
  };
  p?.style_prices.forEach((sp) => {
    prices[sp.style_code] = String(sp.price);
  });
  return {
    theme_id: p?.theme.id ?? null,
    title: p?.title ?? "",
    subtitle: p?.subtitle ?? "",
    region: p?.region ?? "",
    country: p?.country ?? "",
    nights: p ? String(p.nights) : "2",
    days: p ? String(p.days) : "3",
    summary: p?.summary ?? "",
    notes: p?.notes ?? "",
    badges: p?.badges ?? [],
    hero_images: p?.hero_images ?? [],
    highlights: p?.highlights ?? [],
    includes: p?.includes ?? [
      "왕복 항공권",
      "제세공과금(유류할증료·공항세)",
      "여행자보험",
      "전용 차량",
      "관광지 입장료",
    ],
    excludes: p?.excludes ?? ["가이드·기사 경비", "개인 경비", "싱글룸 사용료"],
    prices,
    itinerary: p?.itinerary ?? [emptyDay(1)],
    is_published: p?.is_published ?? false,
    rating: p ? String(p.rating) : "4.7",
    review_count: p ? String(p.review_count) : "0",
  };
}

const TAB_OF_FIELD: Record<string, TabKey> = {
  theme_id: "basic",
  title: "basic",
  nights: "basic",
  days: "basic",
  rating: "basic",
  review_count: "basic",
  prices: "prices",
};

export function PackageForm({
  pkg,
  initialTab = "basic",
}: {
  pkg?: Package;
  initialTab?: TabKey;
}) {
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [f, setF] = useState<FormState>(() => toForm(pkg));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [departures, setDepartures] = useState<Departure[]>(
    pkg?.departures ?? [],
  );
  const [depModal, setDepModal] = useState<DepartureModalState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [saved, setSaved] = useState<Package | undefined>(pkg);

  const loadThemes = useCallback(() => api.staff.themes.list(), []);
  const { data: themes } = useLoad(loadThemes);
  const theme = useMemo(
    () => themes?.find((t) => t.id === f.theme_id) ?? null,
    [themes, f.theme_id],
  );
  const minRank = theme?.min_style_rank ?? 1;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!f.theme_id) e.theme_id = "테마를 선택해 주세요";
    if (!f.title.trim()) e.title = "상품명을 입력해 주세요";
    const nights = Number(f.nights);
    const days = Number(f.days);
    if (f.nights === "" || !Number.isInteger(nights) || nights < 0)
      e.nights = "0 이상의 정수";
    if (f.days === "" || !Number.isInteger(days) || days < 1)
      e.days = "1 이상의 정수";
    else if (!e.nights && days < nights) e.days = "일수는 박수보다 커야 해요";
    const rating = Number(f.rating);
    if (f.rating === "" || Number.isNaN(rating) || rating < 0 || rating > 5)
      e.rating = "0~5 사이";
    const rc = Number(f.review_count);
    if (f.review_count === "" || !Number.isInteger(rc) || rc < 0)
      e.review_count = "0 이상의 정수";
    const avail = STYLES.filter((s) => s.rank >= minRank);
    const hasPrice = avail.some((s) => Number(f.prices[s.code]) > 0);
    if (!hasPrice)
      e.prices = "선택 가능한 스타일 중 최소 하나의 가격을 입력해 주세요";
    avail.forEach((s) => {
      const v = f.prices[s.code];
      if (v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0))
        e[`price_${s.code}`] = "0 이상의 금액";
    });
    return e;
  };

  const toPayload = (): PackageIn => ({
    theme_id: f.theme_id ?? 0,
    title: f.title.trim(),
    subtitle: f.subtitle.trim(),
    region: f.region.trim(),
    country: f.country.trim(),
    nights: Number(f.nights),
    days: Number(f.days),
    hero_images: f.hero_images.map((s) => s.trim()).filter(Boolean),
    summary: f.summary.trim(),
    highlights: f.highlights.map((s) => s.trim()).filter(Boolean),
    includes: f.includes.map((s) => s.trim()).filter(Boolean),
    excludes: f.excludes.map((s) => s.trim()).filter(Boolean),
    notes: f.notes.trim(),
    badges: f.badges,
    style_prices: STYLES.filter(
      (s) => s.rank >= minRank && Number(f.prices[s.code]) > 0,
    ).map((s) => ({
      style_code: s.code,
      price: Number(f.prices[s.code]),
    })),
    itinerary: f.itinerary.map((d, i) => ({
      ...d,
      day_no: i + 1,
      places: d.places.filter(Boolean),
    })),
    is_published: f.is_published,
    rating: Number(f.rating),
    review_count: Number(f.review_count),
  });

  const save = async () => {
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      setTab(
        TAB_OF_FIELD[first] ??
          (first.startsWith("price_") ? "prices" : "basic"),
      );
      toast("입력값을 확인해 주세요", "error");
      return;
    }
    setSaving(true);
    try {
      if (saved) {
        const res = await api.staff.packages.update(saved.id, toPayload());
        setSaved(res);
        setF(toForm(res));
        setDepartures(res.departures);
        toast("상품을 저장했어요", "success");
      } else {
        const res = await api.staff.packages.create(toPayload());
        toast("상품을 등록했어요. 출발일정을 추가해 주세요.", "success");
        router.replace(`/staff/packages/${res.id}?tab=departures`);
      }
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  // ── 일정표 helpers
  const updateDay = (i: number, patch: Partial<ItineraryDay>) =>
    set(
      "itinerary",
      f.itinerary.map((d, j) => (j === i ? { ...d, ...patch } : d)),
    );
  const moveDay = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= f.itinerary.length) return;
    const next = [...f.itinerary];
    [next[i], next[j]] = [next[j], next[i]];
    set(
      "itinerary",
      next.map((d, k) => ({ ...d, day_no: k + 1 })),
    );
  };
  const removeDay = (i: number) =>
    set(
      "itinerary",
      f.itinerary
        .filter((_, j) => j !== i)
        .map((d, k) => ({ ...d, day_no: k + 1 })),
    );

  // ── 출발일정
  const askDeleteDeparture = (d: Departure) =>
    setConfirm({
      title: "출발일정을 삭제할까요?",
      description: (
        <>
          {shortDate(d.depart_date)} 출발 일정을 삭제합니다.
          {d.booked > 0 && (
            <> 이미 예약 {d.booked}명이 있어 삭제가 거절될 수 있어요.</>
          )}
        </>
      ),
      confirmLabel: "삭제",
      tone: "danger",
      onConfirm: async () => {
        if (!saved) return;
        try {
          await api.staff.packages.removeDeparture(saved.id, d.id);
          setDepartures((prev) => prev.filter((x) => x.id !== d.id));
          toast("출발일정을 삭제했어요", "success");
        } catch (e) {
          toast(errMsg(e), "error");
        }
      },
    });

  const depCols: Column<Departure>[] = [
    {
      key: "depart",
      header: "출발일",
      width: "w-[130px]",
      render: (d) => (
        <span className="font-semibold tabular">{d.depart_date}</span>
      ),
    },
    {
      key: "return",
      header: "귀국일",
      width: "w-[130px]",
      render: (d) => <span className="tabular">{d.return_date}</span>,
    },
    {
      key: "cap",
      header: "정원",
      align: "right",
      width: "w-[80px]",
      render: (d) => `${d.capacity}명`,
    },
    {
      key: "booked",
      header: "예약",
      align: "right",
      width: "w-[80px]",
      render: (d) => `${d.booked}명`,
    },
    {
      key: "remaining",
      header: "잔여",
      align: "right",
      width: "w-[80px]",
      render: (d) =>
        d.remaining <= 3 ? (
          <Badge tone="warning">{d.remaining}석</Badge>
        ) : (
          `${d.remaining}석`
        ),
    },
    {
      key: "status",
      header: "상태",
      width: "w-[100px]",
      render: (d) => <DepartureStatusBadge status={d.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/staff/bookings?departure_id=${d.id}`}
            className="inline-flex h-8 items-center rounded-lg px-2 text-[12px] font-semibold text-primary hover:bg-primary-soft"
          >
            예약 보기
          </Link>
          <button
            type="button"
            aria-label="수정"
            onClick={() =>
              saved &&
              setDepModal({
                packageId: saved.id,
                days: Number(f.days) || 1,
                departure: d,
              })
            }
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-ink"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label="삭제"
            onClick={() => askDeleteDeparture(d)}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  const tabs: { value: TabKey; label: string }[] = [
    { value: "basic", label: "기본 정보" },
    { value: "prices", label: "스타일별 가격" },
    { value: "itinerary", label: "일정표" },
    { value: "includes", label: "포함/불포함" },
    { value: "departures", label: "출발일정" },
    { value: "publish", label: "노출" },
  ];

  return (
    <>
      <PageHeader
        title={saved ? saved.title : "새 상품 등록"}
        description={
          saved ? (
            <span className="inline-flex items-center gap-2">
              <PublishedBadge published={saved.is_published} />
              <span>
                {saved.theme.name} · 출발일정 {departures.length}개 · 최저{" "}
                {won(saved.from_price)}
              </span>
            </span>
          ) : (
            "기본 정보와 스타일별 가격을 입력하고 저장하면 출발일정을 추가할 수 있어요."
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/staff/packages")}
            >
              목록으로
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              {saved ? "변경 사항 저장" : "상품 등록"}
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <Tabs<TabKey>
          items={tabs}
          value={tab}
          onChange={setTab}
          className="px-2"
        />

        <div className="p-5 md:p-6">
          {tab === "basic" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="테마" required error={errors.theme_id}>
                    <Select
                      value={f.theme_id ?? ""}
                      onChange={(e) =>
                        set(
                          "theme_id",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">테마 선택</option>
                      {(themes ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {!t.is_active ? " (비활성)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <FieldGroup
                    label="태그(배지)"
                    hint="고객 카드에 표시. 예: 인기, 출발 확정 임박, 신규"
                  >
                    <TagInput
                      value={f.badges}
                      onChange={(v) => set("badges", v)}
                      placeholder="태그 입력 후 Enter"
                    />
                  </FieldGroup>
                </div>
                <Field label="상품명" required error={errors.title}>
                  <Input
                    value={f.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="예: 발리 우붓 & 스미냑 허니문 5일"
                  />
                </Field>
                <Field label="부제">
                  <Input
                    value={f.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                    placeholder="예: 우붓의 숲과 스미냑의 바다를 한 번에"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Field label="지역">
                    <Input
                      value={f.region}
                      onChange={(e) => set("region", e.target.value)}
                      placeholder="발리"
                    />
                  </Field>
                  <Field label="국가">
                    <Input
                      value={f.country}
                      onChange={(e) => set("country", e.target.value)}
                      placeholder="인도네시아"
                    />
                  </Field>
                  <Field label="박" required error={errors.nights}>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={f.nights}
                      onChange={(e) => set("nights", e.target.value)}
                    />
                  </Field>
                  <Field label="일" required error={errors.days}>
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={f.days}
                      onChange={(e) => set("days", e.target.value)}
                    />
                  </Field>
                </div>
                <Field
                  label="상품 요약"
                  hint="상세 페이지 상단에 노출되는 2~3문장 설명"
                >
                  <Textarea
                    value={f.summary}
                    onChange={(e) => set("summary", e.target.value)}
                    placeholder="스미냑 리조트에 머물며 우붓과 울루와뚜를 하루씩 다녀오는 일정입니다."
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="평점" hint="표시용 (0~5)" error={errors.rating}>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      value={f.rating}
                      onChange={(e) => set("rating", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="후기 수"
                    hint="표시용"
                    error={errors.review_count}
                  >
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={f.review_count}
                      onChange={(e) => set("review_count", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <div>
                <FieldGroup label="대표 이미지">
                  <ImageListEditor
                    value={f.hero_images}
                    onChange={(v) => set("hero_images", v)}
                  />
                </FieldGroup>
              </div>
            </div>
          )}

          {tab === "prices" && (
            <div className="max-w-[720px] space-y-4">
              <p className="text-[13px] text-muted">
                1인 기준 금액입니다. 호텔 등급·식사 업그레이드 추가금은 공통
                규칙으로 자동 계산돼요.
                {theme && minRank > 1 && (
                  <>
                    {" "}
                    <b className="text-ink-2">{theme.name}</b> 테마는{" "}
                    <b className="text-ink-2">
                      {
                        STYLE_LABEL[
                          STYLES.find((s) => s.rank === minRank)?.code ??
                            "grand"
                        ]
                      }{" "}
                      스타일 이상
                    </b>
                    만 판매할 수 있어요.
                  </>
                )}
              </p>
              {errors.prices && (
                <p className="text-[13px] text-danger">{errors.prices}</p>
              )}
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="bg-bg text-[12px] text-muted">
                      <th className="h-10 px-4 text-left font-semibold">
                        스타일
                      </th>
                      <th className="h-10 px-4 text-left font-semibold">
                        기본 구성
                      </th>
                      <th className="h-10 px-4 text-right font-semibold">
                        1인 가격 (원)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {STYLES.map((s) => {
                      const disabled = s.rank < minRank;
                      return (
                        <tr key={s.code} className="border-t border-line">
                          <td className="h-14 px-4 font-semibold text-ink">
                            {STYLE_LABEL[s.code]}
                            {disabled && (
                              <Badge tone="muted" className="ml-2">
                                선택 불가
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 text-[13px] text-muted">
                            {STYLE_DESC[s.code]}
                          </td>
                          <td className="px-4">
                            <div className="flex w-[240px] flex-col items-end ml-auto">
                              <Input
                                type="number"
                                min={0}
                                step={10000}
                                inputMode="numeric"
                                disabled={disabled}
                                value={disabled ? "" : f.prices[s.code]}
                                onChange={(e) =>
                                  set("prices", {
                                    ...f.prices,
                                    [s.code]: e.target.value,
                                  })
                                }
                                placeholder={
                                  disabled
                                    ? "이 테마에서는 판매하지 않아요"
                                    : "예: 1290000"
                                }
                                className="h-10 text-right tabular"
                                aria-label={`${STYLE_LABEL[s.code]} 가격`}
                              />
                              {!disabled &&
                                f.prices[s.code] &&
                                Number(f.prices[s.code]) > 0 && (
                                  <span className="mt-1 text-[12px] text-muted tabular">
                                    {won(Number(f.prices[s.code]))}
                                  </span>
                                )}
                              {errors[`price_${s.code}`] && (
                                <span className="mt-1 text-[12px] text-danger">
                                  {errors[`price_${s.code}`]}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "itinerary" && (
            <div className="space-y-4">
              {f.itinerary.length === 0 && (
                <p className="text-[13px] text-muted">
                  일차를 추가해 일정표를 작성해 주세요.
                </p>
              )}
              {f.itinerary.map((d, i) => (
                <div key={i} className="rounded-xl border border-line p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex h-7 items-center rounded-md bg-primary-soft px-2.5 text-[13px] font-bold text-primary">
                      {i + 1}일차
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="위로"
                        disabled={i === 0}
                        onClick={() => moveDay(i, -1)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-bg disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="아래로"
                        disabled={i === f.itinerary.length - 1}
                        onClick={() => moveDay(i, 1)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-bg disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="일차 삭제"
                        onClick={() => removeDay(i)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <Field label="제목">
                      <Input
                        value={d.title}
                        onChange={(e) =>
                          updateDay(i, { title: e.target.value })
                        }
                        placeholder="인천 출발, 스미냑 리조트 체크인"
                        className="h-10"
                      />
                    </Field>
                    <Field label="숙박">
                      <Input
                        value={d.lodging}
                        onChange={(e) =>
                          updateDay(i, { lodging: e.target.value })
                        }
                        placeholder="스미냑 리조트"
                        className="h-10"
                      />
                    </Field>
                    <FieldGroup label="방문 장소" className="lg:col-span-2">
                      <TagInput
                        value={d.places}
                        onChange={(v) => updateDay(i, { places: v })}
                        placeholder="장소 입력 후 Enter"
                      />
                    </FieldGroup>
                    <div className="grid grid-cols-3 gap-3 lg:col-span-2">
                      <Field label="조식">
                        <Input
                          value={d.meals.breakfast}
                          onChange={(e) =>
                            updateDay(i, {
                              meals: { ...d.meals, breakfast: e.target.value },
                            })
                          }
                          placeholder="호텔식"
                          className="h-10"
                        />
                      </Field>
                      <Field label="중식">
                        <Input
                          value={d.meals.lunch}
                          onChange={(e) =>
                            updateDay(i, {
                              meals: { ...d.meals, lunch: e.target.value },
                            })
                          }
                          placeholder="현지식"
                          className="h-10"
                        />
                      </Field>
                      <Field label="석식">
                        <Input
                          value={d.meals.dinner}
                          onChange={(e) =>
                            updateDay(i, {
                              meals: { ...d.meals, dinner: e.target.value },
                            })
                          }
                          placeholder="씨푸드"
                          className="h-10"
                        />
                      </Field>
                    </div>
                    <Field label="설명" className="lg:col-span-2">
                      <Textarea
                        value={d.description}
                        onChange={(e) =>
                          updateDay(i, { description: e.target.value })
                        }
                        className="min-h-[72px]"
                        placeholder="이동 · 관광 · 식사 흐름을 2~3문장으로"
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  set("itinerary", [
                    ...f.itinerary,
                    emptyDay(f.itinerary.length + 1),
                  ])
                }
              >
                <Plus className="size-4" />
                일차 추가
              </Button>
            </div>
          )}

          {tab === "includes" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <FieldGroup label="포함 사항">
                <StringListEditor
                  value={f.includes}
                  onChange={(v) => set("includes", v)}
                  placeholder="예: 왕복 항공권"
                  addLabel="포함 항목 추가"
                />
              </FieldGroup>
              <FieldGroup label="불포함 사항">
                <StringListEditor
                  value={f.excludes}
                  onChange={(v) => set("excludes", v)}
                  placeholder="예: 가이드·기사 경비"
                  addLabel="불포함 항목 추가"
                />
              </FieldGroup>
              <FieldGroup
                label="하이라이트"
                hint="상세 페이지 상단에 3~4개 정도"
              >
                <StringListEditor
                  value={f.highlights}
                  onChange={(v) => set("highlights", v)}
                  placeholder="예: 짐바란 비치 선셋 씨푸드 디너"
                  addLabel="하이라이트 추가"
                  reorder
                />
              </FieldGroup>
              <Field label="유의 사항">
                <Textarea
                  value={f.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className="min-h-[160px]"
                  placeholder="우기 안내, 준비물, 현지 규정 등"
                />
              </Field>
            </div>
          )}

          {tab === "departures" &&
            (saved ? (
              <div className="-m-5 md:-m-6">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                  <p className="text-[13px] text-muted">
                    귀국일은 출발일 + {Math.max(0, Number(f.days) - 1)}일로 자동
                    계산되며 수정할 수 있어요.
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      setDepModal({
                        packageId: saved.id,
                        days: Number(f.days) || 1,
                      })
                    }
                  >
                    <Plus className="size-4" />
                    출발일정 추가
                  </Button>
                </div>
                <DataTable
                  columns={depCols}
                  rows={[...departures].sort((a, b) =>
                    a.depart_date.localeCompare(b.depart_date),
                  )}
                  rowKey={(d) => d.id}
                  emptyTitle="등록된 출발일정이 없어요"
                  emptyDescription="출발일정이 있어야 고객이 예약할 수 있어요."
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
                <p className="text-[15px] font-semibold text-ink">
                  상품을 먼저 저장해 주세요
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  저장이 끝나면 이 탭에서 출발일정을 추가할 수 있어요.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={save}
                  loading={saving}
                >
                  상품 등록
                </Button>
              </div>
            ))}

          {tab === "publish" && (
            <div className="max-w-[560px] space-y-5">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
                <div>
                  <p className="text-[15px] font-semibold text-ink">
                    고객 사이트 노출
                  </p>
                  <p className="mt-1 text-[13px] text-muted">
                    노출을 켜면 테마 페이지와 검색 결과에 상품이 표시됩니다.
                    출발일정이 없으면 예약은 되지 않아요.
                  </p>
                </div>
                <Switch
                  checked={f.is_published}
                  onChange={(v) => set("is_published", v)}
                  label="고객 사이트 노출"
                />
              </div>
              <ul className="space-y-1.5 text-[13px] text-ink-2">
                <li className="flex items-center gap-2">
                  <Check ok={!!f.theme_id && !!f.title.trim()} /> 기본 정보 입력
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    ok={STYLES.some(
                      (s) => s.rank >= minRank && Number(f.prices[s.code]) > 0,
                    )}
                  />{" "}
                  스타일별 가격 1개 이상
                </li>
                <li className="flex items-center gap-2">
                  <Check ok={f.hero_images.filter(Boolean).length > 0} /> 대표
                  이미지 1장 이상
                </li>
                <li className="flex items-center gap-2">
                  <Check ok={departures.some((d) => d.status === "open")} />{" "}
                  모집 중 출발일정 1개 이상
                </li>
              </ul>
              <Button onClick={save} loading={saving}>
                {saved ? "변경 사항 저장" : "상품 등록"}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <DepartureModal
        state={depModal}
        onClose={() => setDepModal(null)}
        onSaved={(d, mode) =>
          setDepartures((prev) =>
            mode === "create"
              ? [...prev, d]
              : prev.map((x) => (x.id === d.id ? d : x)),
          )
        }
      />
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "inline-flex size-4 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white"
          : "inline-flex size-4 items-center justify-center rounded-full border border-line-strong"
      }
      aria-label={ok ? "완료" : "미완료"}
    >
      {ok && <CheckIcon className="size-3" strokeWidth={3} />}
    </span>
  );
}
