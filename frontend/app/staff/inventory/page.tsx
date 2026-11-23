import type { Metadata } from "next";
import { InventoryPage } from "@/components/staff/inventory/inventory-page";

export const metadata: Metadata = { title: "물품 창고" };

export default function StaffInventoryPage() {
  return <InventoryPage />;
}
