"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/components/ui/toast";
import { errMsg } from "./lib";

interface Result<T> {
  /** 어떤 fn/tick 조합으로 받은 결과인지 (loading 파생용) */
  fn: (() => Promise<T>) | null;
  tick: number;
  data: T | null;
  error: string | null;
}

/**
 * 클라이언트 데이터 로딩 훅. `fn` 은 useCallback 으로 감싸서 넘긴다.
 * 실패하면 토스트를 띄우고 error 를 채운다. `reload()` 로 재조회.
 */
export function useLoad<T>(fn: () => Promise<T>) {
  const toast = useToast();
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<Result<T>>({ fn: null, tick: -1, data: null, error: null });

  useEffect(() => {
    let alive = true;
    fn()
      .then((data) => alive && setRes({ fn, tick, data, error: null }))
      .catch((e: unknown) => {
        if (!alive) return;
        const m = errMsg(e);
        toast(m, "error");
        setRes((prev) => ({ fn, tick, data: prev.data, error: m }));
      });
    return () => {
      alive = false;
    };
  }, [fn, tick, toast]);

  const setData: Dispatch<SetStateAction<T | null>> = useCallback((action) => {
    setRes((prev) => ({
      ...prev,
      data: typeof action === "function" ? (action as (p: T | null) => T | null)(prev.data) : action,
    }));
  }, []);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  const loading = res.fn !== fn || res.tick !== tick;
  return { data: res.data, setData, loading, error: res.error, reload };
}
