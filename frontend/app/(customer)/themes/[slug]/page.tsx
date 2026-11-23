import { Suspense } from "react";
import type { Metadata } from "next";
import { ThemeDetailPage } from "@/components/customer/theme-detail-page";

export const metadata: Metadata = { title: "테마별 여행" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <ThemeDetailPage slug={slug} />
    </Suspense>
  );
}
