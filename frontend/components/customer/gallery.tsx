"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Photo } from "@/components/ui/misc";

/** 상세 상단 사진 갤러리: 스와이프/화살표 + "1/8" 카운터 */
export function Gallery({ images, alt, className }: { images: string[]; alt: string; className?: string }) {
  const list = images.length ? images : [""];
  const [idx, setIdx] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = (n: number) => setIdx((n + list.length) % list.length);

  return (
    <div
      className={clsx("group relative overflow-hidden bg-line md:rounded-[var(--radius-card)]", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="상품 사진"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="flex h-full transition-transform duration-400 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {list.map((src, i) => (
          <Photo key={`${src}-${i}`} src={src} alt={`${alt} 사진 ${i + 1}`} className="h-full w-full shrink-0" />
        ))}
      </div>

      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(idx - 1)}
            aria-label="이전 사진"
            className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-[var(--shadow-card)] transition-opacity hover:bg-white md:inline-flex md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(idx + 1)}
            aria-label="다음 사진"
            className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-[var(--shadow-card)] transition-opacity hover:bg-white md:inline-flex md:opacity-0 md:group-hover:opacity-100"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      )}

      <span className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-[12px] font-semibold text-white tabular" aria-live="polite">
        {idx + 1} / {list.length}
      </span>

      {list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" role="tablist" aria-label="사진 선택">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`${i + 1}번째 사진`}
              onClick={() => setIdx(i)}
              className={clsx("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-white" : "w-1.5 bg-white/60")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
