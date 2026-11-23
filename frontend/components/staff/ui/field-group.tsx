import { clsx } from "clsx";

/**
 * 여러 입력/버튼을 담는 편집기(태그 입력, 이미지 목록 등)용 필드 래퍼.
 * `Field` 는 <label> 이라 복합 위젯에 쓰면 첫 입력에 포커스가 튀므로 div 로 감싼다.
 */
export function FieldGroup({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("block", className)} role="group" aria-label={label}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}
