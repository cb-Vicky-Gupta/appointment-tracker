"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";

// Gender-based theme system (PRD Reference F). `data-theme` on <html> is
// `${genderKey}-${themeMode}`, and every themed value in globals.css is a CSS
// variable, so the whole app repaints from this one attribute — no component
// should ever reach for a hardcoded Tailwind color.
//
// themeMode precedence: explicit local override > the signed-in user's saved
// preference > system preference. The header's quick `ThemeToggle` sets a
// local-only override (localStorage) for a fast, no-round-trip flip; the
// profile page's toggle (Phase 9) persists via `PATCH /api/me` *and* calls
// `clearOverride()` so the freshly-saved value drives the app immediately
// instead of being shadowed by a stale local override.
//
// All three inputs are derived values (not effect+setState) so there's
// nothing to synchronize; the only effect below writes the resolved value to
// the DOM, which is the one genuinely external system here.

export type ThemeMode = "light" | "dark";
type GenderKey = "male" | "female" | "other";

interface ThemeContextValue {
  themeMode: ThemeMode;
  toggleThemeMode: () => void;
  /** Drops the local-only override so `themeMode` falls back to the signed-in
   *  user's saved preference (or system preference, if signed out). */
  clearOverride: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "pg-tracker-theme-mode";

function readStoredMode(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function readSystemMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function toGenderKey(gender: string | undefined): GenderKey {
  if (gender === "MALE") return "male";
  if (gender === "FEMALE") return "female";
  return "other";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Start from the same values the server rendered with ("no override, no
  // system preference read yet") rather than reading localStorage/matchMedia
  // in a lazy initializer — that looked SSR-safe (both helpers guard on
  // `typeof window`), but React's *client* render during hydration already
  // has a real `window`, so it would return the real stored/system value on
  // the very first client render and immediately disagree with the server's
  // window-less render, which is a hydration mismatch. Reading them in an
  // effect instead means the first client render matches the server, and
  // this corrects itself right after mount — before any signed-in page
  // renders real content (they all block on a loading state, Reference F).
  const [overrideMode, setOverrideMode] = useState<ThemeMode | null>(null);
  const [systemMode, setSystemMode] = useState<ThemeMode>("light");

  useEffect(() => {
    // Intentional one-time sync from an external system (localStorage +
    // matchMedia) on mount, not derived-from-props state — exactly the case
    // the lint rule's own guidance calls out as legitimate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOverrideMode(readStoredMode());
    setSystemMode(readSystemMode());
  }, []);

  const userMode: ThemeMode | null =
    user?.themeMode === "dark" || user?.themeMode === "light" ? user.themeMode : null;

  const themeMode: ThemeMode = overrideMode ?? userMode ?? systemMode;
  const genderKey = toGenderKey(user?.gender);

  // The only real effect: push the resolved theme onto <html>, which lives
  // outside React's tree.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", `${genderKey}-${themeMode}`);
  }, [genderKey, themeMode]);

  const toggleThemeMode = useCallback(() => {
    setOverrideMode((prev) => {
      const current = prev ?? userMode ?? systemMode;
      const next: ThemeMode = current === "light" ? "dark" : "light";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, [userMode, systemMode]);

  const clearOverride = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setOverrideMode(null);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeMode, toggleThemeMode, clearOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
