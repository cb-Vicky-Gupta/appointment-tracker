"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuth, type Gender, type PublicUser } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { fetchJson } from "@/lib/fetch-json";

export interface UpdateProfileInput {
  name?: string;
  gender?: Gender;
  themeMode?: "light" | "dark";
  specialization?: string;
  institute?: string;
  studentType?: string;
  year?: string;
  phone?: string;
}

// PATCH /api/me (Phase 9). On success, syncs the new profile straight into
// AuthProvider's `user` state (no extra GET /api/me round trip) and, if this
// change touched `themeMode`, drops any local-only override so the
// just-persisted value takes effect immediately instead of being shadowed by
// a stale localStorage toggle.
export function useUpdateProfile() {
  const { authFetch, updateUser } = useAuth();
  const { clearOverride } = useTheme();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const res = await authFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return fetchJson<{ user: PublicUser }>(res);
    },
    onSuccess: ({ user }, input) => {
      updateUser(user);
      if (input.themeMode) clearOverride();
    },
  });
}
