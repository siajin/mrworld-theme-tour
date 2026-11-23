import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  full?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover disabled:bg-muted-2",
  secondary: "bg-primary-soft text-primary hover:bg-[#e3ecff] disabled:text-muted-2",
  outline: "bg-surface text-ink border border-line-strong hover:bg-bg disabled:text-muted-2",
  ghost: "bg-transparent text-ink-2 hover:bg-bg disabled:text-muted-2",
  danger: "bg-danger text-white hover:bg-[#b91c1c] disabled:bg-muted-2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-13 px-5 text-[16px] gap-2 min-h-[52px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  full = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold transition-colors select-none whitespace-nowrap disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
