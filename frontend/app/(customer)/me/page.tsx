import type { Metadata } from "next";
import { MePage } from "@/components/customer/me-page";

export const metadata: Metadata = { title: "내 예약" };

export default function Page() {
  return <MePage />;
}
