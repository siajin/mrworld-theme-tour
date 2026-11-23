"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { BadgePercent, ChevronLeft, ChevronRight, Headset, ShieldCheck, Smartphone } from "lucide-react";
import { Accordion } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { promptInstall } from "@/components/pwa-register";
import { Photo } from "@/components/ui/misc";
import { EVENT_IMAGES } from "@/lib/images";

/* ── 신뢰 요소 3개 ─────────────────────────────────────────────── */
export function TrustRow({ className }: { className?: string }) {
  const items = [
    { icon: BadgePercent, title: "최저가 보장", desc: "같은 일정 더 싼 곳이 있으면 차액을 돌려드려요" },
    { icon: Headset, title: "24시간 고객센터", desc: "여행 중에도 한국어 담당자가 바로 응대해요" },
    { icon: ShieldCheck, title: "안전한 예약", desc: "영업보증보험 가입 · 예약금 10%만 먼저 결제" },
  ];
  return (
    <ul className={clsx("grid gap-3 sm:grid-cols-3", className)}>
      {items.map((it) => (
        <li key={it.title} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <it.icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[15px] font-bold text-ink">{it.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">{it.desc}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── 이벤트 배너 캐러셀 ─────────────────────────────────────────── */
const BANNERS = [
  {
    id: "honeymoon-early",
    eyebrow: "가을 허니문 얼리버드",
    title: "11월 출발 허니문, 그랜드 스타일 예약 시 룸 데코 무료",
    desc: "발리 · 산토리니 · 제주 풀빌라 — 2인 예약이면 바로 출발 확정",
    cta: "허니문 보기",
    href: "/themes/honeymoon",
    bg: "bg-primary",
    image: EVENT_IMAGES.honeymoon,
  },
  {
    id: "parents-gather",
    eyebrow: "효도 여행 동행 모집",
    title: "3명만 모이면 출발 확정, 예약금 10%로 먼저 잡아두세요",
    desc: "초대 코드로 가족·친구를 합류시키면 인원이 자동으로 채워져요",
    cta: "효도 여행 보기",
    href: "/themes/parents",
    bg: "bg-primary-dark",
    image: EVENT_IMAGES.parents,
  },
  {
    id: "golf-danang",
    eyebrow: "골프 시즌 특가",
    title: "다낭 36홀 5일, 11월 출발 잔여 좌석 안내",
    desc: "골프백 운반 · 티오프 예약 포함, 4인 이상은 리무진 업그레이드 상담",
    cta: "골프 보기",
    href: "/themes/golf",
    bg: "bg-ink",
    image: EVENT_IMAGES.golf,
  },
];

export function EventBanners({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % BANNERS.length), 5000);
    return () => window.clearInterval(t);
  }, [paused]);

  const go = (n: number) => setIdx((n + BANNERS.length) % BANNERS.length);

  return (
    <section
      id="events"
      aria-roledescription="carousel"
      aria-label="이벤트"
      className={clsx("relative scroll-mt-20", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-[var(--radius-card)]">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {BANNERS.map((b, i) => (
            <div
              key={b.id}
              aria-hidden={i !== idx}
              className={clsx("relative w-full shrink-0 overflow-hidden text-white", b.bg)}
            >
              <Photo
                src={b.image}
                alt=""
                className="absolute inset-y-0 right-0 hidden w-[42%] md:block"
                imgClassName="object-cover"
              />
              <div
                aria-hidden
                className={clsx("absolute inset-y-0 right-0 hidden w-[42%] md:block", b.bg)}
                style={{ maskImage: "linear-gradient(90deg, #000 0%, transparent 45%)", WebkitMaskImage: "linear-gradient(90deg, #000 0%, transparent 45%)" }}
              />
              <div className="relative px-6 py-7 md:max-w-[60%] md:px-10 md:py-9">
                <p className="text-[12px] font-bold tracking-wide text-white/75">{b.eyebrow}</p>
                <h3 className="mt-1.5 max-w-[620px] text-[20px] font-bold leading-snug md:text-[26px]">{b.title}</h3>
                <p className="mt-2 max-w-[560px] text-[14px] text-white/85">{b.desc}</p>
                <Link
                  href={b.href}
                  tabIndex={i === idx ? 0 : -1}
                  className="mt-5 inline-flex h-10 items-center rounded-[var(--radius-btn)] bg-white px-4 text-[14px] font-semibold text-ink hover:bg-white/90"
                >
                  {b.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => go(idx - 1)}
          aria-label="이전 배너"
          className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:bg-bg"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="배너 선택">
          {BANNERS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`${i + 1}번째 배너`}
              onClick={() => go(i)}
              className={clsx(
                "h-2 rounded-full transition-all",
                i === idx ? "w-6 bg-primary" : "w-2 bg-line-strong hover:bg-muted-2",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(idx + 1)}
          aria-label="다음 배너"
          className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-surface text-ink-2 hover:bg-bg"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
        <span className="ml-1 text-[12px] tabular text-muted">
          {idx + 1} / {BANNERS.length}
        </span>
      </div>
    </section>
  );
}

/* ── PWA 설치 배너 ───────────────────────────────────────────── */
export function InstallBand({ className }: { className?: string }) {
  const toast = useToast();
  // 설치 프롬프트 가능 여부: pwa-register 가 window 에 보관한 이벤트를 구독
  const installable = useSyncExternalStore(
    (cb) => {
      window.addEventListener("mw:installable", cb);
      return () => window.removeEventListener("mw:installable", cb);
    },
    () => !!(window as unknown as { __mwInstallPrompt?: Event }).__mwInstallPrompt,
    () => false,
  );

  const onInstall = async () => {
    const r = await promptInstall();
    if (r === "accepted") toast("홈 화면에 추가했어요", "success");
    else if (r === "unavailable") toast("브라우저 메뉴에서 '홈 화면에 추가'를 선택해 주세요");
  };

  return (
    <section
      className={clsx(
        "flex flex-col gap-5 rounded-[var(--radius-card)] bg-primary px-6 py-7 text-white md:flex-row md:items-center md:justify-between md:px-10 md:py-9",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:inline-flex">
          <Smartphone className="size-6" aria-hidden />
        </span>
        <div>
          <h3 className="text-[20px] font-bold leading-snug md:text-[24px]">홈 화면에 추가하면 앱처럼 쓸 수 있어요</h3>
          <p className="mt-1.5 text-[14px] text-white/85">
            별도 설치 파일 없이 바로 됩니다. 예약 접수·출발 확정 문자는 설치와 상관없이 예약 때 입력한 연락처로 보내드려요.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onInstall}
        aria-label="앱 설치"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-btn)] bg-white px-5 text-[15px] font-semibold text-primary transition-colors hover:bg-white/90 md:h-12 md:px-6"
      >
        {installable ? "지금 설치하기" : "설치 방법 보기"}
      </button>
    </section>
  );
}

/* ── FAQ ────────────────────────────────────────────────────── */
const FAQ = [
  {
    q: "최소 출발 인원이란 무엇인가요?",
    a: "예약 1건(대표자 + 동행)의 인원이 테마별 최소 인원에 도달하면 출발이 확정됩니다. 허니문은 2명, 효도·골프·트레킹은 3명입니다. 인원이 모이기 전까지는 '동행 모집 중' 상태로 예약이 유지되며, 다른 고객과 인원을 합산하지는 않습니다.",
  },
  {
    q: "동행 초대는 어떻게 하나요?",
    a: "예약금 결제 후 발급되는 8자리 초대 코드나 초대 링크를 가족·친구에게 보내세요. 동행이 로그인해 코드를 입력하면 자기 정보로 자동 합류되고, 인원이 채워지는 순간 대표자와 동행 모두에게 확정 문자를 보내드립니다. 회원이 아닌 분은 대표자가 마이페이지에서 이름·연락처로 직접 추가할 수도 있어요.",
  },
  {
    q: "스타일을 바꾸면 요금은 어떻게 달라지나요?",
    a: "클래식(3성·도시락) / 그랜드(4성·현지식) / 프리미엄(5성·고급 레스토랑) 기본가에 호텔 등급과 식사는 1인·1박(1일) 단위 차액으로, 차량은 예약 1건 단위로 계산됩니다. 상세 페이지에서 옵션을 바꾸면 총액이 바로 갱신되어 결제 전에 확인할 수 있어요. 허니문·효도 테마는 그랜드 스타일 이상만 선택할 수 있습니다.",
  },
  {
    q: "취소·환불 규정은 어떻게 되나요?",
    a: "출발 30일 전까지는 예약금 전액 환불, 29~15일 전은 여행 요금의 10%, 14~8일 전은 20%, 7일 이내는 30%를 취소 수수료로 공제합니다(국외여행 표준약관 기준). 최소 출발 인원 미달로 회사가 취소하는 경우에는 전액 환불됩니다.",
  },
  {
    q: "예약금만 내고 예약할 수 있나요?",
    a: "네. 총 여행 요금의 10%(천원 단위 절사)를 예약금으로 결제하면 예약이 접수됩니다. 잔금은 출발 7일 전까지 안내 문자에 따라 납부해 주세요. 단골 등급 할인(실버 5% · 골드 10%)은 총액에 자동 반영됩니다.",
  },
  {
    q: "테마별 기본 제공 물품은 무엇인가요?",
    a: "허니문은 커플 기념티와 룸 데코, 효도는 인삼 기념품과 안마 이용권, 골프는 유명 골프 리조트 테마 연출과 골프공·액세서리, 트레킹은 산악 어드벤처 연출과 아웃도어 스카프를 기본 제공합니다. 기념품은 여행 안내에 따라 전달하고, 연출·체험 서비스는 일정 중 제공됩니다.",
  },
];

export function FaqSection({ className }: { className?: string }) {
  return (
    <section id="faq" className={clsx("scroll-mt-20", className)}>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface px-5">
        {FAQ.map((f, i) => (
          <Accordion key={f.q} title={f.q} defaultOpen={i === 0} className={i === FAQ.length - 1 ? "border-b-0" : ""}>
            {f.a}
          </Accordion>
        ))}
      </div>
    </section>
  );
}

/* ── 인기 검색 키워드 ───────────────────────────────────────── */
const KEYWORDS = ["제주 허니문", "규슈 온천", "다낭 골프", "발리 풀빌라", "산토리니", "지리산 종주", "장가계", "홋카이도 트레킹"];

export function PopularKeywords({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <section className={className} aria-label="인기 검색 키워드">
      <div className="flex flex-wrap gap-2">
        {KEYWORDS.map((k, i) => (
          <button
            key={k}
            type="button"
            onClick={() => router.push(`/search?q=${encodeURIComponent(k)}`)}
            aria-label={`${k} 검색`}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13.5px] text-ink-2 transition-colors hover:border-primary hover:text-primary"
          >
            <span className="text-[12px] font-bold tabular text-primary">{i + 1}</span>
            {k}
          </button>
        ))}
      </div>
    </section>
  );
}
