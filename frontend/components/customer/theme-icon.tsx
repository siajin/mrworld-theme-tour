import { Compass, Flag, HandHeart, Heart, Mountain, type LucideProps } from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  heart: Heart,
  "hand-heart": HandHeart,
  flag: Flag,
  mountain: Mountain,
};

/** 테마의 lucide 아이콘명 → 컴포넌트 (모르는 이름은 나침반) */
export function ThemeIcon({ name, ...rest }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? Compass;
  return <Icon {...rest} />;
}

/** "허니문 낭만 투어" → "허니문" 처럼 짧은 이름 */
export function shortThemeName(name: string) {
  const map: Record<string, string> = {
    "허니문 낭만 투어": "허니문",
    "효도 힐링 투어": "효도",
    "골프 챌린지 투어": "골프",
    "아웃도어 트레킹 투어": "트레킹",
  };
  return map[name] ?? name.replace(/ 투어$/, "");
}
