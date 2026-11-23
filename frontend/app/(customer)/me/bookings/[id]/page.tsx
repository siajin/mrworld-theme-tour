import type { Metadata } from "next";
import { BookingDetailPage } from "@/components/customer/booking-detail-page";

export const metadata: Metadata = { title: "예약 상세" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetailPage id={id} />;
}
