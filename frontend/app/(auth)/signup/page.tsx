import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/customer/auth-forms";
import { AuthCard } from "@/components/customer/auth-card";

export const metadata: Metadata = { title: "회원가입" };

export default function Page() {
  return (
    <AuthCard title="회원가입" description="가입 즉시 예약할 수 있고, 여행을 다녀올수록 단골 할인이 커져요.">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
