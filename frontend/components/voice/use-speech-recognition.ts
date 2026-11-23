"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type SpeechState = "idle" | "listening" | "processing" | "denied" | "error";

/** 브라우저의 SpeechRecognition 생성자 (없으면 null). SSR 에서는 항상 null. */
export function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** 침묵이 이어지면 자동 종료 (ms) */
const SILENCE_MS = 8000;

const ERROR_MESSAGE: Record<string, string> = {
  "not-allowed": "마이크 사용이 차단되어 있어요. 브라우저 주소창의 마이크 아이콘에서 허용해 주세요",
  "service-not-allowed": "마이크 사용이 차단되어 있어요. 브라우저 주소창의 마이크 아이콘에서 허용해 주세요",
  "no-speech": "말씀이 들리지 않았어요. 다시 시도해 주세요",
  network: "음성 인식 서버에 연결하지 못했어요 (인터넷 연결 확인)",
  "audio-capture": "마이크를 찾지 못했어요",
};

export interface SpeechCallbacks {
  /** 최종 인식 결과 (state 는 "processing" 으로 바뀐 뒤 호출) */
  onFinal?: (text: string) => void;
  /** 권한 거부("denied") 또는 인식 오류("error") — 메시지는 사용자에게 그대로 보여 줄 수 있다 */
  onError?: (kind: "denied" | "error", message: string) => void;
}

const noSubscribe = () => () => {};

/**
 * Web Speech API 래퍼. ko-KR, 중간 결과 표시, 한 문장 인식(continuous=false).
 * - `start()` 로 인식 시작 → `interim` 갱신 → 최종 결과가 오면 `finalText` 세팅 + state "processing" + `onFinal(text)`
 * - 호출한 쪽(VoiceProvider)이 결과를 소비한 뒤 `reset()` 으로 idle 로 돌린다.
 * - 오류는 state "denied"/"error" + `error` 메시지 + `onError(kind, message)`
 * - 8초 동안 아무 말도 없으면 자동으로 멈춘다.
 */
export function useSpeechRecognition(callbacks: SpeechCallbacks = {}) {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => getSpeechRecognitionCtor() !== null,
    () => false,
  );
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  });
  const [state, setState] = useState<SpeechState>("idle");
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognition | null>(null);
  const silenceRef = useRef<number | null>(null);
  const gotFinalRef = useRef(false);
  /** onend 에서 "듣는 중이었는데 결과 없이 끝났는지" 판단용 */
  const listeningRef = useRef(false);

  const clearSilence = () => {
    if (silenceRef.current !== null) {
      window.clearTimeout(silenceRef.current);
      silenceRef.current = null;
    }
  };

  const armSilence = useCallback(() => {
    clearSilence();
    silenceRef.current = window.setTimeout(() => {
      // 결과 없이 침묵이 이어지면 중단 → onend 에서 no-speech 처리
      const rec = recRef.current;
      if (rec) {
        try {
          rec.stop();
        } catch {
          /* 이미 멈춘 경우 */
        }
      }
    }, SILENCE_MS);
  }, []);

  const teardown = useCallback(() => {
    clearSilence();
    const rec = recRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      recRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      const message = "이 브라우저는 음성 인식을 지원하지 않아요";
      setState("error");
      setError(message);
      cbRef.current.onError?.("error", message);
      return;
    }
    // 이전 세션 정리
    if (recRef.current) {
      const previous = recRef.current;
      teardown();
      try {
        previous.abort();
      } catch {
        /* noop */
      }
    }

    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    gotFinalRef.current = false;

    rec.onstart = () => {
      listeningRef.current = true;
      setState("listening");
      armSilence();
    };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      if (recRef.current !== rec || gotFinalRef.current) return;
      let text = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        text += r[0]?.transcript ?? "";
        if (r.isFinal) isFinal = true;
      }
      text = text.trim();
      setInterim(text);
      if (isFinal && text) {
        gotFinalRef.current = true;
        listeningRef.current = false;
        clearSilence();
        setFinalText(text);
        setState("processing");
        try {
          rec.stop();
        } catch {
          /* noop */
        }
        cbRef.current.onFinal?.(text);
      } else {
        armSilence();
      }
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (recRef.current !== rec) return;
      clearSilence();
      listeningRef.current = false;
      if (e.error === "aborted") {
        // 사용자가 취소한 경우 — 조용히 idle
        setState("idle");
        return;
      }
      const denied = e.error === "not-allowed" || e.error === "service-not-allowed";
      const message = ERROR_MESSAGE[e.error] ?? "음성 인식에 실패했어요. 다시 시도해 주세요";
      setError(message);
      setState(denied ? "denied" : "error");
      cbRef.current.onError?.(denied ? "denied" : "error", message);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      clearSilence();
      recRef.current = null;
      // 최종 결과 없이 끝났으면(침묵 자동 종료 등) no-speech 로 취급
      if (listeningRef.current && !gotFinalRef.current) {
        setError(ERROR_MESSAGE["no-speech"]);
        setState("error");
        cbRef.current.onError?.("error", ERROR_MESSAGE["no-speech"]);
      }
      listeningRef.current = false;
    };

    recRef.current = rec;
    setInterim("");
    setFinalText("");
    setError(null);
    listeningRef.current = true;
    setState("listening");
    try {
      rec.start();
    } catch {
      const message = "음성 인식을 시작하지 못했어요. 잠시 후 다시 시도해 주세요";
      setError(message);
      setState("error");
      teardown();
      cbRef.current.onError?.("error", message);
      return;
    }
    armSilence();
  }, [armSilence, teardown]);

  /** 지금까지 들은 내용으로 마무리 (최종 결과가 오면 processing) */
  const stop = useCallback(() => {
    clearSilence();
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  /** 취소: 결과를 버리고 idle */
  const abort = useCallback(() => {
    clearSilence();
    listeningRef.current = false;
    const rec = recRef.current;
    teardown();
    try {
      rec?.abort();
    } catch {
      /* noop */
    }
    setInterim("");
    setFinalText("");
    setError(null);
    setState("idle");
  }, [teardown]);

  /** 결과 소비 후 초기화 */
  const reset = useCallback(() => {
    setInterim("");
    setFinalText("");
    setError(null);
    setState("idle");
  }, []);

  useEffect(() => () => abort(), [abort]);

  return { supported, state, interim, finalText, error, start, stop, abort, reset };
}
