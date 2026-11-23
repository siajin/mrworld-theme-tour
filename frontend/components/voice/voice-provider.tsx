"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AIParseResult, VoiceContext } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { VoiceListeningSheet } from "./voice-listening-sheet";
import { VoiceConfirmSheet } from "./voice-confirm-sheet";
import { VoiceHelpSheet } from "./voice-help-sheet";
import { searchHrefFromParse } from "./search-href";
import { useSpeechRecognition } from "./use-speech-recognition";
import { VoiceBookingDialog } from "./voice-booking-dialog";

/** 화면별 명령 처리기. true 를 돌려주면 처리 완료(토스트는 처리기가 띄운다), false 면 "이 화면에서는 쓸 수 없는 명령" */
export type VoiceHandle = (result: AIParseResult, transcript: string) => boolean | Promise<boolean>;
export interface VoiceHandler {
  context: VoiceContext;
  handle: VoiceHandle;
}

export type VoiceState = "idle" | "listening" | "processing" | "confirm" | "help";

interface VoiceApi {
  /** 브라우저가 Web Speech API 를 지원하는지 (SSR/첫 렌더에서는 false) */
  supported: boolean;
  /** 현재 흐름 단계 — 마이크 버튼의 링 애니메이션 등에 사용 */
  state: VoiceState;
  /** 마이크 열기. 미지원 브라우저면 토스트만 띄운다. */
  open: () => void;
  /** 질문과 답변을 이어 가는 음성 예약 열기. */
  openConversation: () => void;
  /** 현재 화면 컨텍스트 (/ai/parse 의 context) */
  context: VoiceContext;
  setContext: (c: VoiceContext) => void;
  /** 화면별 처리기 등록 → 해제 함수 반환. 등록되는 동안 context 도 그 값으로 바뀐다. */
  registerHandler: (h: VoiceHandler) => () => void;
}

const VoiceCtx = createContext<VoiceApi | null>(null);

const IMMEDIATE = new Set(["go_back", "go_home", "my_bookings", "help"]);

/**
 * 음성 명령 전체 흐름을 소유하는 Provider (고객 셸에 한 번 마운트).
 * 마이크 → Web Speech API → /ai/parse(text, context) → 확인 시트 → 실행(전역 또는 화면 처리기)
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { user } = useAuth();
  const [phase, setPhase] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<AIParseResult | null>(null);
  const [context, setContextState] = useState<VoiceContext>("other");
  const [conversationOpen, setConversationOpen] = useState(false);

  const handlersRef = useRef<VoiceHandler[]>([]);
  const contextRef = useRef<VoiceContext>("other");
  /** 세션 번호 — 취소/재시작 후 늦게 도착한 파싱 결과를 무시하기 위해 */
  const sessionRef = useRef(0);

  const setContext = useCallback((c: VoiceContext) => {
    contextRef.current = c;
    setContextState(c);
  }, []);

  const registerHandler = useCallback(
    (h: VoiceHandler) => {
      handlersRef.current = [h, ...handlersRef.current];
      setContext(h.context);
      return () => {
        handlersRef.current = handlersRef.current.filter((x) => x !== h);
        // 남아 있는 처리기가 있으면 그 화면의 컨텍스트로, 없으면 other
        setContext(handlersRef.current[0]?.context ?? "other");
      };
    },
    [setContext],
  );

  // ── 실행 ────────────────────────────────────────────────────
  const execute = useCallback(
    async (r: AIParseResult, said: string) => {
      switch (r.intent) {
        case "search":
          if (r.matched_package_ids.length === 0) {
            toast("조건에 맞는 상품이 아직 없어요. 다른 조건으로 말씀해 주세요");
            return;
          }
          router.push(searchHrefFromParse(r, said));
          return;
        case "go_back":
          toast(r.reply);
          router.back();
          return;
        case "go_home":
          toast(r.reply);
          router.push("/");
          return;
        case "my_bookings":
          toast(r.reply);
          router.push(user ? "/me" : `/login?next=${encodeURIComponent("/me")}`);
          return;
        case "help":
          setPhase("help");
          return;
        case "unknown":
          return;
        default: {
          // 화면별 처리기 (최근 등록 순)
          for (const h of handlersRef.current) {
            try {
              if (await h.handle(r, said)) return;
            } catch (err) {
              toast(err instanceof Error ? err.message : "명령을 실행하지 못했어요", "error");
              return;
            }
          }
          toast("이 화면에서는 쓸 수 없는 명령이에요");
        }
      }
    },
    [router, toast, user],
  );
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  // ── 인식 결과 → /ai/parse → 분기 (즉시 실행 / 확인 시트 / 도움말) ──
  const speech = useSpeechRecognition({
    onFinal: (said) => {
      const session = sessionRef.current;
      setTranscript(said);
      setPhase("processing");
      api.ai
        .parse(said, contextRef.current)
        .then(async (r) => {
          if (sessionRef.current !== session) return; // 그 사이 취소/재시작
          resetRef.current();
          setResult(r);
          if (IMMEDIATE.has(r.intent)) {
            if (r.intent === "help") setPhase("help");
            else {
              setPhase("idle");
              await executeRef.current(r, said);
            }
            return;
          }
          setPhase("confirm");
        })
        .catch((err: unknown) => {
          if (sessionRef.current !== session) return;
          resetRef.current();
          setPhase("idle");
          toast(err instanceof Error ? err.message : "음성을 이해하지 못했어요", "error");
        });
    },
    onError: (_kind, message) => {
      toast(message, "error");
      resetRef.current();
      setPhase("idle");
    },
  });
  const { supported, interim, start: sStart, abort: sAbort, reset: sReset } = speech;
  // 콜백(onFinal/onError)은 훅 호출 시점에 만들어지므로 reset 은 ref 로 참조한다
  const resetRef = useRef(sReset);
  useEffect(() => {
    resetRef.current = sReset;
  }, [sReset]);

  const close = useCallback(() => {
    sessionRef.current += 1;
    sAbort();
    setPhase("idle");
    setResult(null);
    setTranscript("");
  }, [sAbort]);

  // A command recorded on the previous screen must not be applied to a newly
  // opened product after browser Back/Forward or another navigation.
  useEffect(() => () => close(), [pathname, close]);

  const open = useCallback(() => {
    setConversationOpen(false);
    if (!supported) {
      toast("이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Edge에서 이용해 주세요");
      return;
    }
    sessionRef.current += 1;
    setResult(null);
    setTranscript("");
    setPhase("listening");
    sStart();
  }, [supported, sStart, toast]);

  const openConversation = useCallback(() => {
    close();
    setConversationOpen(true);
  }, [close]);

  const onConfirm = useCallback(async () => {
    if (!result) return;
    const r = result;
    const said = transcript;
    setPhase("idle");
    setResult(null);
    await execute(r, said);
  }, [execute, result, transcript]);

  const onRetry = useCallback(() => {
    setResult(null);
    open();
  }, [open]);

  const value = useMemo<VoiceApi>(
    () => ({ supported, state: phase, open, openConversation, context, setContext, registerHandler }),
    [supported, phase, open, openConversation, context, setContext, registerHandler],
  );

  return (
    <VoiceCtx.Provider value={value}>
      {children}
      {conversationOpen && <VoiceBookingDialog onClose={() => setConversationOpen(false)} />}
      <VoiceListeningSheet
        open={phase === "listening" || phase === "processing"}
        interim={phase === "processing" ? transcript : interim}
        processing={phase === "processing"}
        onCancel={close}
      />
      <VoiceConfirmSheet
        open={phase === "confirm" && !!result}
        transcript={transcript}
        result={result}
        mode={result?.intent === "unknown" ? "unknown" : "confirm"}
        onConfirm={onConfirm}
        onRetry={onRetry}
        onClose={close}
      />
      <VoiceHelpSheet open={phase === "help"} onClose={close} onRetry={onRetry} />
    </VoiceCtx.Provider>
  );
}

/** 음성 명령 API. VoiceProvider 안에서만 쓸 수 있다. */
export function useVoice(): VoiceApi {
  const ctx = useContext(VoiceCtx);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}

/** Provider 밖(예: 인증 화면)에서도 안전하게 쓰는 버전 — 없으면 null */
export function useVoiceOptional(): VoiceApi | null {
  return useContext(VoiceCtx);
}

/**
 * 화면 컨텍스트 + 처리기 등록 편의 훅. 마운트 시 등록, 언마운트 시 해제.
 * `handle` 은 매 렌더 최신 클로저를 참조하므로 useCallback 없이 넘겨도 된다.
 */
export function useVoiceContext(context: VoiceContext, handle?: VoiceHandle) {
  const voice = useVoiceOptional();
  const handleRef = useRef<VoiceHandle | undefined>(handle);
  useEffect(() => {
    handleRef.current = handle;
  });
  const register = voice?.registerHandler;
  useEffect(() => {
    if (!register) return;
    return register({
      context,
      handle: (r, t) => (handleRef.current ? handleRef.current(r, t) : false),
    });
  }, [context, register]);
}
