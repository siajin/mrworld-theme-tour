import type { Metadata } from "next";
import { PackageDetailPage } from "@/components/customer/package-detail-page";

export const metadata: Metadata = { title: "상품 상세" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PackageDetailPage id={id} />;
}
