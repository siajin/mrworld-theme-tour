import type { Metadata } from "next";
import { StaffShell } from "@/components/staff/shell/staff-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | 미스터 월드 Admin" },
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
