"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import type { Theme } from "@/lib/types";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { VoiceButton, searchHrefFromParse } from "@/components/voice";
import { CountStepper } from "./count-stepper";
import { todayIso } from "./utils";

const HINTS = ["부모님이랑 10월에 편하게", "둘이서 로맨틱하게 5일", "골프 치러 넷이서"];

const fieldBox =
  "flex h-14 items-center gap-2.5 rounded-[var(--radius-input)] border border-line bg-bg px-3.5 focus-within:border-primary focus-within:bg-surface transition-colors";

/** 여기어때 검색박스를 한 카드 안에: 테마·지역 / 출발일 / 총 인원 / 검색 */
export function SearchCard({
  themes,
  regions,
  theme,
  onThemeChange,
  className,
}: {
  themes: Theme[];
  regions: string[];
  theme: string;
  onThemeChange: (slug: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [region, setRegion] = useState("");
  const [date, setDate] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [parsing, setParsing] = useState<string | null>(null);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = new URLSearchParams();
    if (theme) p.set("theme", theme);
    if (region.trim()) p.set("region", region.trim());
    if (date) p.set("depart_from", date);
    p.set("travelers", String(travelers));
    router.push(`/search?${p.toString()}`);
  };

  const onHint = async (text: string) => {
    if (parsing) return;
    setParsing(text);
    try {
      const r = await api.ai.parse(text);
      router.push(searchHrefFromParse(r, text));
    } catch (err) {
      toast(err instanceof Error ? err.message : "검색 조건을 이해하지 못했어요", "error");
      setParsing(null);
    }
  };

  return (
    <div className={className}>
      <form
        onSubmit={submit}
        aria-label="여행 검색"
        className="rounded-[20px] border border-line bg-surface p-4 shadow-[var(--shadow-float)] md:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_0.9fr_auto] md:items-end [&>*]:min-w-0">
          <div className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted">테마 · 지역 · 명소</span>
            <div className={clsx(fieldBox, "pr-1.5")}>
              <MapPin className="size-[18px] shrink-0 text-muted" aria-hidden />
              <select
                aria-label="테마"
                value={theme}
                onChange={(e) => onThemeChange(e.target.value)}
                className="h-full w-[92px] shrink-0 bg-transparent text-[14px] font-semibold text-ink outline-none"
              >
                <option value="">전체 테마</option>
                {themes.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name.replace(/ 투어$/, "")}
                  </option>
                ))}
              </select>
              <span className="h-5 w-px bg-line" aria-hidden />
              <input
                list="mw-regions"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="어디로 떠나세요? 예) 제주, 발리"
                aria-label="지역 또는 명소"
                className="h-full w-0 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted-2"
              />
              <datalist id="mw-regions">
                {regions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <VoiceButton />
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted">출발일</span>
            <div className={fieldBox}>
              <CalendarDays className="size-[18px] shrink-0 text-muted" aria-hidden />
              <input
                type="date"
                value={date}
                min={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                aria-label="출발일"
                className="h-full w-0 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none tabular"
              />
            </div>
          </label>

          <div className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted">총 인원</span>
            <div className={clsx(fieldBox, "justify-between")}>
              <Users className="size-[18px] shrink-0 text-muted" aria-hidden />
              <CountStepper value={travelers} onChange={setTravelers} min={1} max={10} size="sm" label="총 인원" />
            </div>
          </div>

          <Button type="submit" size="lg" className="h-14 md:w-[132px]" aria-label="검색">
            <Search className="size-5" aria-hidden />
            검색
          </Button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
        <span className="text-[13px] font-semibold text-muted">이렇게 말해보세요</span>
        {HINTS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onHint(h)}
            disabled={parsing !== null}
            aria-label={`"${h}" 로 검색`}
            className={clsx(
              "rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-primary hover:text-primary disabled:opacity-60",
              parsing === h && "border-primary text-primary",
            )}
          >
            “{h}”
          </button>
        ))}
      </div>
    </div>
  );
}
