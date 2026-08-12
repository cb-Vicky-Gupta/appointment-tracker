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
  createdAt: string;
  updatedAt: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface SignupInput {
  name: string;
  email: string;
  password: string;
  gender: Gender;
}

interface AuthContextValue {
  user: PublicUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  /** fetch() wrapper that attaches the current access token and retries once
   *  after a silent refresh if the first call comes back 401. Use this for
   *  every call to a protected API route from Phase 5 onward. */
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function extractErrorMessage(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

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
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Login failed"));
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setUser(data.user);
    setStatus("authenticated");
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await extractErrorMessage(res, "Sign up failed"));
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
    <AuthContext.Provider value={{ user, status, login, signup, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
