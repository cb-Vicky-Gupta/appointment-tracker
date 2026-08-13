"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { fetchJson } from "@/lib/fetch-json";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-user-detail";

interface AdminUpdateUserInput {
  status?: "ACTIVE" | "SUSPENDED";
  role?: "USER" | "ADMIN";
  forceLogout?: true;
}

// PATCH /api/admin/users/:id — suspend/reactivate, role change, and
// force-logout all go through this one mutation (Plan Phase B's route
// accepts any combination in one call); invalidates both the list and that
// user's own detail query so the UI reflects the change immediately rather
// than waiting for the next background refetch.
export function useUpdateAdminUser(userId: string) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdminUpdateUserInput) => {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return fetchJson<{ user: AdminUserDetail }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
  });
}

// DELETE /api/admin/users/:id — the one truly irreversible action; the
// detail page's own confirm-by-typing-the-email gate (not this hook) is
// what actually protects against a misclick.
export function useDeleteAdminUser() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await authFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      return fetchJson<{ message: string }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}
