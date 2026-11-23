import type { Metadata } from "next";
import { CustomersTable } from "@/components/staff/customers/customers-table";

export const metadata: Metadata = { title: "고객 관리" };

export default function StaffCustomersPage() {
  return <CustomersTable />;
}
