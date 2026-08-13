"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { fetchJson } from "@/lib/fetch-json";

export interface AdminStats {
  totalUsers: number;
  totalPatients: number;
  totalAppointments: number;
  signupsToday: number;
  signupsThisWeek: number;
  suspendedUsers: number;
  adminUsers: number;
}

export function useAdminStats() {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/stats");
      return fetchJson<AdminStats>(res);
    },
  });
}
