import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingFlow } from "@/components/customer/booking-flow";

export const metadata: Metadata = { title: "예약하기" };

export default async function Page({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  return (
    <Suspense fallback={null}>
      <BookingFlow packageId={packageId} />
    </Suspense>
  );
}
