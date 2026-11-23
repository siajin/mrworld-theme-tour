import Link from "next/link";
import { Compass } from "lucide-react";

/** 페이지 안에서 쓰는 "찾을 수 없어요" 블록 (404 페이지와 같은 톤) */
export function NotFoundBlock({
  title = "페이지를 찾을 수 없어요",
  description = "주소가 잘못되었거나 삭제된 페이지예요.",
  backHref = "/",
  backLabel = "홈으로",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col items-center px-4 py-24 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-[22px] font-bold text-ink">{title}</h1>
      <p className="mt-2 max-w-[360px] text-[14px] text-muted">{description}</p>
      <div className="mt-6 flex gap-2">
        <Link
          href={backHref}
          className="inline-flex h-11 items-center rounded-[var(--radius-btn)] bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
        >
          {backLabel}
        </Link>
        <Link
          href="/themes"
          className="inline-flex h-11 items-center rounded-[var(--radius-btn)] border border-line-strong bg-surface px-5 text-[15px] font-semibold text-ink hover:bg-bg"
        >
          테마 둘러보기
        </Link>
      </div>
    </div>
  );
}
