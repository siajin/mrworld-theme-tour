"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col items-center px-4 py-24 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-[22px] font-bold text-ink">화면을 표시하는 중 문제가 생겼어요</h1>
      <p className="mt-2 max-w-[400px] text-[14px] text-muted">
        잠시 후 다시 시도해 주세요. 계속되면 고객센터 1588-0000 으로 알려 주시면 바로 확인하겠습니다.
      </p>
      {error.message && <p className="mt-3 rounded-lg bg-bg px-3 py-2 text-[12px] text-muted-2">{error.message}</p>}
      <Button className="mt-6" onClick={reset} aria-label="다시 시도">
        다시 시도
      </Button>
    </div>
  );
}
