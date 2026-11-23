"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { Trip } from "@/lib/types";
import { BOOKING_STATUS, duration, fullDate, won } from "@/lib/format";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/misc";

const SESSION_KEY = "mw_trips_popup_shown";
const MAX_ROWS = 5;
/** 로그인 폼이 세션에 남기는 표시 — 로그인 직후 전체 새로고침이 있어도 팝업을 한 번은 띄우기 위함 */
export const LOGIN_PENDING_KEY = "mw_login_pending";

function readFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * 로그인 직후 1회 "지난 여행" 팝업. 세션당 1회(sessionStorage).
 * 고객 셸(layout)에 마운트한다.
 */
export function TripsPopup() {
  const { user, justLoggedIn, consumeJustLoggedIn } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    if (!justLoggedIn && !readFlag(LOGIN_PENDING_KEY)) return;
    if (readFlag(SESSION_KEY)) {
      consumeJustLoggedIn();
      return;
    }
    let cancelled = false;
    api.me
      .trips()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => b.depart_date.localeCompare(a.depart_date));
        if (sorted.length > 0) {
          setTrips(sorted);
          setOpen(true);
        }
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
          window.sessionStorage.removeItem(LOGIN_PENDING_KEY);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* 팝업은 부가 기능 — 실패해도 조용히 넘어간다 */
      })
      .finally(() => {
        if (!cancelled) consumeJustLoggedIn();
      });
    return () => {
      cancelled = true;
    };
  }, [justLoggedIn, user, consumeJustLoggedIn]);

  if (!trips) return null;

  const close = () => setOpen(false);

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        <span>
          지난 여행 <span className="ml-1 text-[14px] font-semibold text-muted">{trips.length}건</span>
        </span>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="outline" full onClick={close}>
            닫기
          </Button>
          <Button
            full
            onClick={() => {
              close();
              router.push("/me");
            }}
          >
            전체 보기
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-[14px] text-muted">
        {user?.name}님, 다시 만나 반가워요. 최근 여행부터 정리해 드렸어요.
      </p>
      <ul className="divide-y divide-line">
        {trips.slice(0, MAX_ROWS).map((t) => {
          const st = BOOKING_STATUS[t.status];
          return (
            <li key={t.booking_id} className="flex gap-3 py-3">
              <Photo src={t.hero_image} alt={t.package_title} className="size-[72px] shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold text-ink">{t.package_title}</p>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {t.theme_name} · {duration(t.nights, t.days)} · {t.style_name} 스타일
                </p>
                <p className="mt-1 flex items-center justify-between text-[13px]">
                  <span className="tabular text-muted-2">{fullDate(t.depart_date)} 출발</span>
                  <span className="tabular font-semibold text-ink">{won(t.total)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {trips.length > MAX_ROWS && (
        <p className="pt-3 text-center text-[13px] text-muted">외 {trips.length - MAX_ROWS}건은 전체 보기에서 확인할 수 있어요</p>
      )}
    </Modal>
  );
}
