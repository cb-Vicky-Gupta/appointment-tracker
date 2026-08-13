"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

export interface DashboardStats {
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  thisWeekAppointments: number;
}

export function useDashboardStats() {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await authFetch("/api/dashboard/stats");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json() as Promise<DashboardStats>;
    },
  });
}
