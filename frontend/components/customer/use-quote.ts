"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Quote, QuoteRequest } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { addonsToRequest, type BookingOptions } from "./utils";

export function toQuoteRequest(packageId: number, o: BookingOptions): QuoteRequest | null {
  if (!o.departureId) return null;
  return {
    package_id: packageId,
    departure_id: o.departureId,
    style_code: o.style,
    hotel_grade: o.hotel,
    meal_code: o.meal,
    transport_code: o.transport,
    addons: addonsToRequest(o.addons),
    travelers_count: o.travelers,
  };
}

/**
 * 옵션이 바뀔 때마다 300ms 디바운스 후 /bookings/quote 호출.
 * 마지막 요청만 반영하고, 이전 견적은 새 견적이 올 때까지 유지한다(깜빡임 방지).
 * `refreshKey` 가 바뀌면(로그인·로그아웃 등) 같은 옵션으로 다시 견적을 내고, 그동안 이전 견적은 버린다(할인율이 달라지므로).
 * 백엔드가 400(테마 하한·차량 정원 등)을 돌려주면 `error` 로 노출하고 토스트로도 알린다 — 조용히 옛 가격을 보여 주지 않는다.
 */
export function useQuote(packageId: number | null, options: BookingOptions | null, refreshKey?: unknown) {
  const toast = useToast();
  // 견적·실패는 (요청 키, 사용자 키) 로 태그해 두고, 둘 다 현재와 맞는 것만 유효하게 본다
  const [result, setResult] = useState<{ key: string; refresh: string; quote: Quote } | null>(null);
  const [failure, setFailure] = useState<{ key: string; refresh: string; message: string } | null>(null);
  const latest = useRef("");
  const lastToast = useRef("");

  const req = packageId && options ? toQuoteRequest(packageId, options) : null;
  const key = req ? JSON.stringify(req) : "";
  const refresh = refreshKey == null ? "" : String(refreshKey);
  const stamp = `${refresh}\u0000${key}`;

  useEffect(() => {
    latest.current = stamp;
    if (!key) return;
    const t = window.setTimeout(() => {
      api.bookings
        .quote(JSON.parse(key) as QuoteRequest)
        .then((q) => {
          if (latest.current !== stamp) return;
          setResult({ key, refresh, quote: q });
          setFailure(null);
          lastToast.current = "";
        })
        .catch((err: unknown) => {
          if (latest.current !== stamp) return;
          const message = err instanceof ApiError ? err.message : "견적을 계산하지 못했어요";
          setFailure({ key, refresh, message });
          if (lastToast.current !== message) {
            lastToast.current = message;
            toast(message, "error");
          }
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [key, refresh, stamp, toast]);

  const error = failure && failure.key === key && failure.refresh === refresh ? failure.message : null;
  // 로그인 상태가 바뀌면(할인율이 달라짐) 이전 사용자의 견적은 보여 주지 않는다
  const quote = key && result?.refresh === refresh ? result.quote : null;
  const loading = !!key && !(result?.key === key && result.refresh === refresh) && !error;

  return { quote, loading, error };
}
