import type { Metadata } from "next";
import { Dashboard } from "@/components/staff/dashboard";

export const metadata: Metadata = { title: "대시보드" };

export default function StaffDashboardPage() {
  return <Dashboard />;
}
