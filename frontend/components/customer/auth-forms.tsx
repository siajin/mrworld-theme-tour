"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { phoneFormat } from "@/lib/format";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { LOGIN_PENDING_KEY } from "./trips-popup";

function markLoginPending() {
  try {
    window.sessionStorage.removeItem("mw_trips_popup_shown");
    window.sessionStorage.setItem(LOGIN_PENDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** next 파라미터는 같은 사이트 경로만 허용 */
function safeNext(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

function useAfterAuth() {
  const router = useRouter();
  const sp = useSearchParams();
  return (user: User) => {
    if (user.role === "staff") {
      router.replace("/staff");
      return;
    }
    router.replace(safeNext(sp.get("next"), "/"));
  };
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={6}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-bg hover:text-ink"
      >
        {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
      </button>
    </div>
  );
}

export function LoginForm() {
  const { login } = useAuth();
  const toast = useToast();
  const after = useAfterAuth();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = sp.get("next");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email.trim(), password);
      markLoginPending();
      toast(`${u.name}님, 환영합니다`, "success");
      after(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했어요");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="로그인">
      <Field label="이메일" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          required
          autoFocus
        />
      </Field>
      <Field label="비밀번호" required error={error ?? undefined}>
        <PasswordInput value={password} onChange={setPassword} placeholder="6자 이상" autoComplete="current-password" />
      </Field>
      <Button type="submit" size="lg" full loading={busy} aria-label="로그인">
        로그인
      </Button>

      <div className="flex items-start gap-2 rounded-[var(--radius-input)] bg-primary-soft px-3.5 py-3 text-[13px] text-primary-dark">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-semibold">체험용 계정</p>
          <p className="mt-0.5 tabular">
            demo@customer.com / demo1234
            <button
              type="button"
              onClick={() => {
                setEmail("demo@customer.com");
                setPassword("demo1234");
              }}
              className="ml-2 rounded-md bg-surface px-2 py-0.5 text-[12px] font-semibold text-primary hover:bg-white"
              aria-label="체험용 계정 정보 채우기"
            >
              자동 입력
            </button>
          </p>
          <p className="mt-2 tabular">
            직원: admin@mrworld.com / admin1234
            <button
              type="button"
              onClick={() => {
                setEmail("admin@mrworld.com");
                setPassword("admin1234");
              }}
              className="ml-2 rounded-md bg-surface px-2 py-0.5 text-[12px] font-semibold text-primary hover:bg-white"
              aria-label="직원 체험용 계정 정보 채우기"
            >
              자동 입력
            </button>
          </p>
        </div>
      </div>

      <p className="text-center text-[14px] text-muted">
        아직 회원이 아니세요?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-primary hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}

export function SignupForm() {
  const { signup } = useAuth();
  const toast = useToast();
  const after = useAfterAuth();
  const sp = useSearchParams();
  const next = sp.get("next");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", address: "" });
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError("이용약관과 개인정보처리방침에 동의해 주세요");
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 10) {
      setError("연락처를 정확히 입력해 주세요");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const u = await signup({ ...form, email: form.email.trim(), name: form.name.trim() });
      markLoginPending();
      toast("가입을 환영합니다. 첫 여행을 준비해 볼까요?", "success");
      after(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했어요");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="회원가입">
      <Field label="이름" required>
        <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="여권과 같은 이름" autoComplete="name" required autoFocus />
      </Field>
      <Field label="이메일" required>
        <Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@example.com" autoComplete="email" required />
      </Field>
      <Field label="비밀번호" required hint="6자 이상">
        <PasswordInput value={form.password} onChange={set("password")} autoComplete="new-password" />
      </Field>
      <Field label="연락처" required hint="출발 확정·동행 합류 소식을 문자로 보내드려요">
        <Input
          type="tel"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => set("phone")(phoneFormat(e.target.value))}
          placeholder="010-0000-0000"
          autoComplete="tel"
          required
        />
      </Field>
      <Field label="주소" required hint="여행 서류 발송 주소 (우편번호 검색은 준비 중)">
        <Input value={form.address} onChange={(e) => set("address")(e.target.value)} placeholder="예) 서울 동대문구 왕산로 200" autoComplete="street-address" required />
      </Field>

      <div className="space-y-2.5 rounded-[var(--radius-input)] border border-line bg-bg p-3.5">
        <Checkbox
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label={
            <span>
              <span className="text-danger">(필수)</span>{" "}
              <Link href="/terms" className="underline">
                이용약관
              </Link>{" "}
              및{" "}
              <Link href="/privacy" className="underline">
                개인정보처리방침
              </Link>
              에 동의합니다
            </span>
          }
        />
        <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label="(선택) 특가·이벤트 소식을 문자로 받겠습니다" />
      </div>

      {error && (
        <p role="alert" className="rounded-[var(--radius-input)] bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" full loading={busy} aria-label="가입하기">
        가입하기
      </Button>
      <p className="text-center text-[14px] text-muted">
        이미 회원이세요?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-primary hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
