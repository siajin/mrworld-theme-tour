import type { Metadata } from "next";
import { JoinPage } from "@/components/customer/join-page";

export const metadata: Metadata = { title: "동행 초대" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinPage code={code} />;
}
