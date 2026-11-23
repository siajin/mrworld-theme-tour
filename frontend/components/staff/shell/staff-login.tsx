"use client";

import { Globe, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { errMsg } from "@/components/staff/lib";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";

/** 직원 인라인 로그인 카드. 고객 계정으로 로그인하면 안내 후 로그아웃. */
export function StaffLogin({ wrongRole }: { wrongRole: boolean }) {
  const { login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해 주세요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await login(email.trim(), password);
      if (u.role !== "staff") {
        setError("직원 계정으로 로그인해 주세요");
        logout();
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-[400px] p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-white">
            <Globe className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[17px] font-bold leading-tight text-ink">
              미스터 월드 Admin
            </p>
            <p className="text-[13px] text-muted">직원 전용 운영 콘솔</p>
          </div>
        </div>

        {wrongRole && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              고객 계정으로 로그인되어 있어요. 직원 계정으로 로그인해 주세요.
              <button
                type="button"
                onClick={logout}
                className="ml-1 font-semibold underline"
              >
                로그아웃
              </button>
            </span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="이메일" required>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mrworld.com"
            />
          </Field>
          <Field label="비밀번호" required error={error ?? undefined}>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
            />
          </Field>
          <Button type="submit" full loading={busy}>
            로그인
          </Button>
        </form>

        <p className="mt-5 text-center text-[12px] text-muted-2">
          <Link href="/" className="underline-offset-2 hover:underline">
            고객 사이트로 이동
          </Link>
        </p>
      </Card>
    </div>
  );
}
