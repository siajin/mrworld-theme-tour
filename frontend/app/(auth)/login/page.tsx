import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/customer/auth-forms";
import { AuthCard } from "@/components/customer/auth-card";

export const metadata: Metadata = { title: "로그인" };

export default function Page() {
  return (
    <AuthCard title="로그인" description="예약 내역 확인과 동행 초대는 로그인 후 이용할 수 있어요.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
