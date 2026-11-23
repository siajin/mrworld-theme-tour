import type { Metadata } from "next";
import { BookingComplete } from "@/components/customer/booking-complete";

export const metadata: Metadata = { title: "예약 완료" };

export default async function Page({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingComplete bookingId={bookingId} />;
}
