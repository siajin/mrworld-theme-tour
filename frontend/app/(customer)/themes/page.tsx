import type { Metadata } from "next";
import { ThemesPage } from "@/components/customer/themes-page";

export const metadata: Metadata = { title: "테마별 여행" };

export default function Page() {
  return <ThemesPage />;
}
