import type { Metadata } from "next";
import { NotificationsTable } from "@/components/staff/notifications-table";

export const metadata: Metadata = { title: "알림 로그" };

export default function StaffNotificationsPage() {
  return <NotificationsTable />;
}
