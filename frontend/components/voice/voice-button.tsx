"use client";

import { clsx } from "clsx";
import { Mic } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useVoiceOptional } from "./voice-provider";

export interface VoiceButtonProps {
  variant?: "inline" | "fab";
  className?: string;
}

const UNSUPPORTED = "이 브라우저는 음성 인식을 지원하지 않아요. Chrome 또는 Edge에서 이용해 주세요";

/**
 * 마이크 버튼. 누르면 `useVoice().open()` — 인식 → 해석 → 확인 → 실행 흐름은 VoiceProvider 가 담당.
 * inline = 입력창·헤더·하단 바 슬롯, fab = 모바일 하단 탭 바 중앙의 둥근 버튼.
 * 듣는 중이면 은은한 링이 퍼진다.
 */
export function VoiceButton({ variant = "inline", className }: VoiceButtonProps) {
  const toast = useToast();
  const voice = useVoiceOptional();
  const listening = voice?.state === "listening";

  const handleClick = () => {
    if (!voice || !voice.supported) {
      toast(UNSUPPORTED);
      return;
    }
    voice.open();
  };

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="음성 명령"
        aria-pressed={listening}
        className={clsx(
          "relative inline-flex size-[52px] items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-float)] transition-colors hover:bg-primary-hover active:scale-[0.97]",
          className,
        )}
      >
        {listening && <span className="voice-ring absolute inset-0 rounded-full bg-primary/40" aria-hidden />}
        <Mic className="relative size-6" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="음성 명령"
      aria-pressed={listening}
      className={clsx(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary-soft hover:text-primary",
        listening ? "bg-primary-soft text-primary" : "text-muted",
        className,
      )}
    >
      {listening && <span className="voice-ring absolute inset-0 rounded-full bg-primary/30" aria-hidden />}
      <Mic className="relative size-[18px]" aria-hidden />
    </button>
  );
}
