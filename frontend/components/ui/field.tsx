import { clsx } from "clsx";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base =
  "w-full rounded-[var(--radius-input)] border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted-2 focus:border-primary focus:outline-none disabled:bg-bg disabled:text-muted";

export function Field({
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
    <label className={clsx("block", className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(base, "h-11", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(base, "py-2.5 min-h-[96px] leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(base, "h-11 pr-9 appearance-none bg-no-repeat bg-[right_12px_center]", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={clsx("inline-flex items-start gap-2.5 cursor-pointer text-[14px] text-ink-2", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] accent-primary" {...rest} />
      <span>{label}</span>
    </label>
  );
}
