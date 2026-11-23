import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Flag,
  HandHeart,
  Heart,
  Mountain,
  Ship,
  Snowflake,
  Sparkles,
  Sun,
  Tag,
  Tent,
  Utensils,
  Waves,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  heart: Heart,
  "hand-heart": HandHeart,
  flag: Flag,
  mountain: Mountain,
  sun: Sun,
  ship: Ship,
  tent: Tent,
  camera: Camera,
  utensils: Utensils,
  waves: Waves,
  snowflake: Snowflake,
  sparkles: Sparkles,
};

/** 테마 아이콘 이름(lucide) → 아이콘. 모르는 이름은 태그 아이콘으로 대체. */
export function ThemeIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = MAP[name] ?? Tag;
  return <Icon className={className} aria-hidden />;
}
