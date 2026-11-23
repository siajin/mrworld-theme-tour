"use client";

import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "./sidebar";
import { StaffLogin } from "./staff-login";
import { Topbar } from "./topbar";

/** 직원 화면 껍데기: 인증 가드 + 사이드바 + 상단바 */
export function StaffShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh bg-bg">
        <div className="fixed inset-y-0 left-0 w-16 border-r border-line bg-surface lg:w-60" />
        <div className="pl-16 lg:pl-60">
          <div className="h-14 border-b border-line bg-surface" />
          <div className="space-y-4 p-6">
            <Skeleton className="h-7 w-40" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "staff") {
    return <StaffLogin wrongRole={!!user && user.role !== "staff"} />;
  }

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-h-dvh flex-col pl-16 lg:pl-60">
        <Topbar user={user} onLogout={logout} />
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
