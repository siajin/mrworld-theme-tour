"use client";

import { clsx } from "clsx";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Tone = "info" | "success" | "error";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<{ toast: (message: string, tone?: Tone) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: string, tone: Tone = "info") => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  const Icon = { info: Info, success: CheckCircle2, error: AlertCircle };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-8 z-[200] flex flex-col items-center gap-2 px-4">
        {items.map((t) => {
          const I = Icon[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className={clsx(
                "pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-[14px] font-medium shadow-[var(--shadow-float)] max-w-[420px] w-full md:w-auto",
                t.tone === "error" ? "bg-danger text-white" : "bg-ink text-white",
              )}
            >
              <I className="size-4 shrink-0" />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}
