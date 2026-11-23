import type { Metadata } from "next";
import { PackageForm } from "@/components/staff/packages/package-form";

export const metadata: Metadata = { title: "새 상품 등록" };

export default function StaffNewPackagePage() {
  return <PackageForm />;
}
