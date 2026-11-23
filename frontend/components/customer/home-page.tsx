"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { api } from "@/lib/api";
import type { FeaturedPackages, PackageCard as PackageCardType, Theme } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { SectionTitle } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { EmptyState, Photo } from "@/components/ui/misc";
import { SearchCard } from "./search-card";
import { ThemeIconRow } from "./theme-icon-row";
import { ThemeCard, ThemeCardSkeleton } from "./theme-card";
import { PackageCard, PackageCardSkeleton } from "./package-card";
import { HERO_IMAGE } from "@/lib/images";
import { EventBanners, FaqSection, InstallBand, PopularKeywords, TrustRow } from "./home-sections";
import { shortThemeName } from "./theme-icon";
import { useListVoiceCommands } from "./voice-handlers";

const Container = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`mx-auto max-w-[1120px] px-4 ${className}`}>{children}</div>
);

export function HomePage() {
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [featured, setFeatured] = useState<FeaturedPackages | null>(null);
  const [allPackages, setAllPackages] = useState<PackageCardType[]>([]);
  const [theme, setTheme] = useState("");
  const [popularTab, setPopularTab] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.themes.list(), api.packages.featured(), api.packages.list()])
      .then(([t, f, p]) => {
        if (!alive) return;
        setThemes(t);
        setFeatured(f);
        setAllPackages(p);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        toast(err instanceof Error ? err.message : "데이터를 불러오지 못했어요", "error");
        setThemes([]);
        setFeatured({ popular: [], closing_soon: [], by_theme: {} });
      });
    return () => {
      alive = false;
    };
  }, [toast]);

  const regions = useMemo(() => Array.from(new Set(allPackages.map((p) => p.region))).sort(), [allPackages]);

  const popularList = useMemo(() => {
    if (!featured) return null;
    if (!popularTab) return featured.popular;
    return featured.by_theme[popularTab] ?? [];
  }, [featured, popularTab]);

  // 음성: "두 번째 상품" → 지금 보이는 인기 패키지 카드 순서 기준
  useListVoiceCommands("home", popularList ? popularList.slice(0, 6) : null);

  // 서버 렌더 시점에 img 가 실패하면 onError 가 하이드레이션 전에 지나가므로, 사진은 데이터가 온 뒤에만 렌더한다
  const heroPhoto = themes ? HERO_IMAGE : null;

  return (
    <>
      {/* ── 히어로 + 검색 카드 ─────────────────────────────────── */}
      <section className="bg-surface">
        <Container className="pt-8 md:pt-12">
          <div className="grid items-center gap-8 md:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="text-[13px] font-bold tracking-wide text-primary">테마 여행 전문 · 미스터 월드</p>
              <h1 className="mt-3 text-[32px] font-bold leading-[1.15] tracking-tight text-primary-dark md:text-[46px]">
                특별한 날,
                <br />
                가장 멋있는 장소에서
                <br />
                <span className="text-primary">사랑하는 사람에게</span>
                <br />
                <span className="text-primary">잊지 못할 여행의 감동을</span>
              </h1>
              <p className="mt-5 max-w-[460px] text-[15px] leading-relaxed text-muted md:text-[16px]">
                허니문·효도·골프·트레킹. 테마마다 차량, 숙소, 식사, 기념품까지 미리 맞춰 두었습니다. 출발일과 인원만
                고르면 나머지는 저희가 준비합니다.
              </p>
              <dl className="mt-6 flex gap-6 text-[13px] text-muted">
                <div>
                  <dt className="sr-only">운영 테마</dt>
                  <dd>
                    <span className="block text-[22px] font-bold tabular text-ink">4</span>가지 테마
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">상품 수</dt>
                  <dd>
                    <span className="block text-[22px] font-bold tabular text-ink">{allPackages.length || 12}</span>개 패키지
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">예약금</dt>
                  <dd>
                    <span className="block text-[22px] font-bold tabular text-ink">10%</span>예약금만 결제
                  </dd>
                </div>
              </dl>
            </div>
            <Photo
              src={heroPhoto}
              alt="여행지 풍경"
              className="aspect-[4/3] w-full rounded-[24px] md:aspect-[5/4]"
              imgClassName="object-cover"
            />
          </div>
        </Container>

        <Container className="relative z-10 -mb-14 mt-8 md:-mb-20 md:mt-10">
          <ThemeIconRow themes={themes ?? []} value={theme} onChange={setTheme} className="mb-5" />
          <SearchCard themes={themes ?? []} regions={regions} theme={theme} onThemeChange={setTheme} />
        </Container>
      </section>

      {/* ── 본문 ─────────────────────────────────────────────── */}
      <div className="bg-bg pt-24 md:pt-32">
        <Container>
          <TrustRow />
        </Container>

        <Container className="mt-14">
          <EventBanners />
        </Container>

        <Container className="mt-16">
          <SectionTitle
            eyebrow="Themes"
            title="테마별 맞춤 여행"
            action={
              <Link href="/themes" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary hover:underline">
                전체 보기 <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {themes === null
              ? Array.from({ length: 4 }).map((_, i) => <ThemeCardSkeleton key={i} />)
              : themes.map((t) => <ThemeCard key={t.id} theme={t} />)}
          </div>
        </Container>

        <Container className="mt-16">
          <SectionTitle eyebrow="Popular" title="지금 인기 패키지" />
          <ChipRow className="mt-5">
            <Chip selected={popularTab === ""} onClick={() => setPopularTab("")} aria-label="전체 테마">
              전체
            </Chip>
            {(themes ?? []).map((t) => (
              <Chip key={t.slug} selected={popularTab === t.slug} onClick={() => setPopularTab(t.slug)}>
                {shortThemeName(t.name)}
              </Chip>
            ))}
          </ChipRow>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularList === null ? (
              Array.from({ length: 6 }).map((_, i) => <PackageCardSkeleton key={i} />)
            ) : popularList.length === 0 ? (
              <div className="col-span-full">
                <EmptyState title="아직 등록된 패키지가 없어요" description="다른 테마를 선택해 보세요." />
              </div>
            ) : (
              popularList.slice(0, 6).map((p) => <PackageCard key={p.id} pkg={p} />)
            )}
          </div>
        </Container>

        <Container className="mt-16">
          <SectionTitle
            eyebrow="Closing soon"
            title={
              <span className="inline-flex items-center gap-2">
                출발 확정 임박
                <Clock3 className="size-5 text-accent" aria-hidden />
              </span>
            }
            action={<span className="text-[13px] text-muted">잔여 인원이 적은 출발일정</span>}
          />
          <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {featured === null
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-[260px] shrink-0 md:w-auto">
                    <PackageCardSkeleton />
                  </div>
                ))
              : featured.closing_soon.map((p) => (
                  <div key={p.id} className="w-[260px] shrink-0 md:w-auto">
                    <PackageCard pkg={p} />
                  </div>
                ))}
          </div>
        </Container>

        <Container className="mt-16">
          <InstallBand />
        </Container>

        <Container className="mt-16">
          <SectionTitle eyebrow="FAQ" title="자주 묻는 질문" />
          <FaqSection className="mt-6" />
        </Container>

        <Container className="mt-12">
          <SectionTitle title={<span className="text-[18px] md:text-[20px]">인기 검색 키워드</span>} />
          <PopularKeywords className="mt-4" />
        </Container>
      </div>
    </>
  );
}
