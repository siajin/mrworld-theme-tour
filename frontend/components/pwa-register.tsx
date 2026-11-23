"use client";

import { useEffect } from "react";

/** 서비스워커 등록 + 설치 프롬프트 이벤트를 window 에 보관 (홈 배너에서 사용) */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 개발 서버에서도 등록해야 휴대폰 Chrome 이 "앱 설치" 를 제안한다. sw.js 는 아이콘·이미지·manifest 만 캐시한다.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __mwInstallPrompt?: Event }).__mwInstallPrompt = e;
      window.dispatchEvent(new Event("mw:installable"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}

/** 홈 배너 등에서 호출: 설치 프롬프트가 있으면 띄우고 결과를 돌려준다. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const w = window as unknown as { __mwInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> } };
  const ev = w.__mwInstallPrompt;
  if (!ev) return "unavailable";
  await ev.prompt();
  const choice = await ev.userChoice;
  w.__mwInstallPrompt = undefined;
  return choice.outcome;
}
