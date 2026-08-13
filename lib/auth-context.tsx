"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseErrorMessage } from "@/lib/fetch-error";

// Client-side session state. Per the PRD (Section 4 / Reference B): the access
// token lives only in memory (this context, backed by a ref so authFetch always
// reads the latest value) — never localStorage, never a cookie on the web side.
// The refresh token is an httpOnly cookie the browser sends automatically; we
// never touch it directly from JS here.

export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  gender: Gender;
  themeMode: string;
  // Professional details (Profile page) — all optional/nullable since
  // they're filled in after signup, not during it.
  specialization: string | null;
  institute: string | null;
  studentType: string | null;
  year: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  /** Step 3 of signup (lib/hooks and app/(auth)/signup/page.tsx own steps
   *  1-2 — collecting details and verifying the emailed OTP — since neither
   *  produces a session). Exchanges the signupToken from a verified OTP plus
   *  a freshly-chosen password for a real session, same shape as `login`. */
  completeSignup: (signupToken: string, password: string) => Promise<void>;
  /** Same idea as `completeSignup`, for the forgot-password flow — exchanges
   *  the resetToken from a verified reset OTP plus a new password for a
   *  session, signing the user straight in. */
  completePasswordReset: (resetToken: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** fetch() wrapper that attaches the current access token and retries once
   *  after a silent refresh if the first call comes back 401. Use this for
   *  every call to a protected API route from Phase 5 onward. */
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** Syncs local session state with a fresh user object — e.g. after
   *  `PATCH /api/me` returns the updated profile (Phase 9), so callers don't
   *  need a second round trip just to see their own change reflected. */
  updateUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const accessTokenRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      accessTokenRef.current = null;
      return null;
    }
    const { accessToken } = await res.json();
    accessTokenRef.current = accessToken;
    return accessToken as string;
  }, []);

  const authFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const withToken = (token: string | null): RequestInit => ({
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      let res = await fetch(path, withToken(accessTokenRef.current));
      if (res.status === 401) {
        const refreshed = await refresh();
        if (refreshed) res = await fetch(path, withToken(refreshed));
      }
      return res;
    },
    [refresh]
  );

  // On mount (including every full page reload): try to silently exchange the
  // httpOnly refresh cookie for a fresh access token, then load the profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refresh();
      if (!token) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled) return;
      if (!res.ok) {
        setStatus("unauthenticated");
        return;
      }
      const { user: me } = await res.json();
      setUser(me);
      setStatus("authenticated");
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Login failed"));
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const completeSignup = useCallback(async (signupToken: string, password: string) => {
    const res = await fetch("/api/auth/signup/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupToken, password }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Couldn't create your account"));
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const completePasswordReset = useCallback(async (resetToken: string, password: string) => {
    const res = await fetch("/api/auth/reset-password/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToken, password }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Couldn't reset your password"));
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    accessTokenRef.current = null;
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        completeSignup,
        completePasswordReset,
        logout,
        authFetch,
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
