import type { Metadata } from "next";
import { Suspense } from "react";
import { PackageTable } from "@/components/staff/packages/package-table";

export const metadata: Metadata = { title: "상품 관리" };

export default function StaffPackagesPage() {
  return (
    <Suspense fallback={null}>
      <PackageTable />
    </Suspense>
  );
}
