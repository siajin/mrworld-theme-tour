import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageEditor } from "@/components/staff/packages/package-editor";

export const metadata: Metadata = { title: "상품 수정" };

export default async function StaffEditPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <PackageEditor id={id} />
    </Suspense>
  );
}
