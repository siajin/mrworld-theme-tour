import type { Metadata } from "next";
import { SettingsForm } from "@/components/staff/settings-form";

export const metadata: Metadata = { title: "설정" };

export default function StaffSettingsPage() {
  return <SettingsForm />;
}
