import { clsx } from "clsx";

/** 콘텐츠 상단 제목 + 설명 + 액션 버튼 영역 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "mb-5 flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[14px] text-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** 카드 내부 섹션 헤더 (테이블 카드 제목줄) */
export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div>
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[12px] text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
