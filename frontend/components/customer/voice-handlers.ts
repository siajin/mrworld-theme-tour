"use client";

import { useRouter } from "next/navigation";
import type { AIParseResult, PackageCard, VoiceContext } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { useVoiceContext } from "@/components/voice";

/** "n번째 상품" 인덱스(1부터, -1 = 마지막) → 목록 항목. 없으면 null */
export function pickByIndex<T>(items: T[], index: number | null | undefined): T | null {
  if (!index || items.length === 0) return null;
  if (index === -1) return items[items.length - 1] ?? null;
  return items[index - 1] ?? null;
}

/**
 * 목록 화면(홈·검색·테마) 공용 음성 처리기: "두 번째 상품" → 상세로 이동, "예약해줘" → 상품 먼저 고르라고 안내.
 * `items` 는 화면에 보이는 카드 순서 그대로 넘긴다.
 */
export function useListVoiceCommands(context: VoiceContext, items: PackageCard[] | null | undefined) {
  const router = useRouter();
  const toast = useToast();

  useVoiceContext(context, (r: AIParseResult) => {
    if (r.intent === "select_result") {
      const list = items ?? [];
      if (list.length === 0) {
        toast("아직 보여 줄 상품이 없어요");
        return true;
      }
      const hit = pickByIndex(list, r.slots.index);
      if (!hit) {
        toast(`${r.slots.index}번째 상품이 없어요 (총 ${list.length}개)`);
        return true;
      }
      toast(`${hit.title} 상세로 이동할게요`);
      router.push(`/packages/${hit.id}`);
      return true;
    }
    if (r.intent === "book") {
      toast("먼저 상품을 골라 주세요");
      return true;
    }
    return false;
  });
}
