import type { Metadata } from "next";
import { ThemeGrid } from "@/components/staff/themes/theme-grid";

export const metadata: Metadata = { title: "테마 관리" };

export default function StaffThemesPage() {
  return <ThemeGrid />;
}
