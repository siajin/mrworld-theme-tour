import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingsPage } from "@/components/staff/bookings/bookings-page";

export const metadata: Metadata = { title: "예약 관리" };

export default function StaffBookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsPage />
    </Suspense>
  );
}
