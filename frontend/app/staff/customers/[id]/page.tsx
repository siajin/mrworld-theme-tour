import type { Metadata } from "next";
import { CustomerDetail } from "@/components/staff/customers/customer-detail";

export const metadata: Metadata = { title: "고객 상세" };

export default async function StaffCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
