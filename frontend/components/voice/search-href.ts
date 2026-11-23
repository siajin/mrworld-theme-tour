import type { AIParseResult } from "@/lib/types";

/**
 * /ai/parse 결과 → 검색 결과 URL.
 * 힌트 칩(1단계)과 음성 인식(2단계)이 같은 함수를 써서 결과 흐름이 동일하다.
 */
export function searchHrefFromParse(r: AIParseResult, originalText?: string) {
  const p = new URLSearchParams();
  if (r.theme_slug) p.set("theme", r.theme_slug);
  if (r.region) p.set("region", r.region);
  if (r.depart_from) p.set("depart_from", r.depart_from);
  if (r.depart_to) p.set("depart_to", r.depart_to);
  if (r.travelers_count) p.set("travelers", String(r.travelers_count));
  if (r.style_code) p.set("style", r.style_code);
  if (r.budget_max) p.set("max_price", String(r.budget_max));
  if (r.summary) p.set("summary", r.summary);
  if (originalText) p.set("said", originalText);
  return `/search?${p.toString()}`;
}
