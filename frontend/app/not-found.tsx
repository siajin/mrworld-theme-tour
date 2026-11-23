import Link from "next/link";
import { Compass, Plane } from "lucide-react";

export default function RootNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-center">
      <Link href="/" aria-label="미스터 월드 홈으로" className="inline-flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-[9px] bg-primary text-white">
          <Plane className="size-[18px]" aria-hidden />
        </span>
        <span className="text-[18px] font-bold text-ink">미스터 월드</span>
      </Link>
      <span className="mt-10 inline-flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-[22px] font-bold text-ink">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 max-w-[360px] text-[14px] text-muted">주소가 잘못되었거나 삭제된 페이지예요. 홈에서 다시 찾아보세요.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-[var(--radius-btn)] bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
      >
        홈으로
      </Link>
    </div>
  );
}
