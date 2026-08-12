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
// preference > system preference. Until Phase 9 wires `PATCH /api/me`, the
// override is local-only (localStorage) — an explicit, accepted gap per the
// Phase 4 build notes, not an oversight.
//
// All three inputs are derived values (not effect+setState) so there's
// nothing to synchronize; the only effect below writes the resolved value to
// the DOM, which is the one genuinely external system here.

export type ThemeMode = "light" | "dark";
type GenderKey = "male" | "female" | "other";

interface ThemeContextValue {
  themeMode: ThemeMode;
  toggleThemeMode: () => void;
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

  // Lazy initializers run once per mount and are SSR-safe (both helpers
  // return a stable default when `window` isn't available yet).
  const [overrideMode, setOverrideMode] = useState<ThemeMode | null>(readStoredMode);
  const [systemMode] = useState<ThemeMode>(readSystemMode);

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

  return (
    <ThemeContext.Provider value={{ themeMode, toggleThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
