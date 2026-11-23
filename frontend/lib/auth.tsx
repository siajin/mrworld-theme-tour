"use client";

// 로그인 상태 컨텍스트. 토큰은 lib/api.ts 가 관리하고, 여기서는 사용자 객체와 로그인/로그아웃만 다룬다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, loadTokens, saveTokens } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  /** 최초 토큰 검사 중이면 true */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (b: { email: string; password: string; name: string; phone: string; address: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** 로그인 직후 1회만 true — 이전 여행 팝업 트리거용. 소비하면 false로 돌린다. */
  justLoggedIn: boolean;
  consumeJustLoggedIn: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const sessionRevision = useRef(0);

  const refresh = useCallback(async () => {
    const revision = ++sessionRevision.current;
    try {
      const nextUser = await (loadTokens() ? api.me.get() : Promise.resolve(null));
      if (revision === sessionRevision.current) setUser(nextUser);
    } catch (error) {
      if (revision !== sessionRevision.current) return;
      // A temporary offline/500 response must not destroy a valid session.
      if (error instanceof ApiError && error.status === 401) {
        saveTokens(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Read persisted authentication after hydration, and discard an abandoned
    // Strict Mode mount before it can start a redundant request.
    Promise.resolve()
      .then(() => (active ? refresh() : undefined))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    ++sessionRevision.current;
    const res = await api.auth.login({ email, password });
    saveTokens({ access_token: res.access_token, refresh_token: res.refresh_token });
    setUser(res.user);
    setJustLoggedIn(true);
    return res.user;
  }, []);

  const signup = useCallback(async (b: { email: string; password: string; name: string; phone: string; address: string }) => {
    ++sessionRevision.current;
    const res = await api.auth.signup(b);
    saveTokens({ access_token: res.access_token, refresh_token: res.refresh_token });
    setUser(res.user);
    setJustLoggedIn(true);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    ++sessionRevision.current;
    saveTokens(null);
    setUser(null);
    setJustLoggedIn(false);
    try {
      window.sessionStorage.removeItem("mw_trips_popup_shown");
      window.sessionStorage.removeItem("mw_login_pending");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      refresh,
      justLoggedIn,
      consumeJustLoggedIn: () => setJustLoggedIn(false),
    }),
    [user, loading, login, signup, logout, refresh, justLoggedIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
