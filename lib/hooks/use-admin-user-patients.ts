"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { fetchJson } from "@/lib/fetch-json";
import type { PatientListItem } from "@/lib/hooks/use-patients";

interface AdminUserPatientsResponse {
  patients: PatientListItem[];
  page: number;
  pageSize: number;
  total: number;
}

// GET /api/admin/users/:id/patients — read-only, for the admin user detail
// page (Plan Phase D follow-up). Same shape as usePatients, just scoped to
// someone else's account instead of the caller's own.
export function useAdminUserPatients(userId: string, search: string, page: number) {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["admin-user-patients", userId, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      const res = await authFetch(`/api/admin/users/${userId}/patients?${params.toString()}`);
      return fetchJson<AdminUserPatientsResponse>(res);
    },
    enabled: Boolean(userId),
    placeholderData: (previous) => previous,
  });
}
