"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { AdminUserListItem } from "@/lib/hooks/use-admin-users";

export interface AdminUserDetail extends AdminUserListItem {
  appointmentCount: number;
  activeSessionCount: number;
}

export function useAdminUserDetail(userId: string) {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["admin-user", userId],
    queryFn: async () => {
      const res = await authFetch(`/api/admin/users/${userId}`);
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json() as Promise<{ user: AdminUserDetail }>;
    },
    enabled: Boolean(userId),
    retry: false, // a 404 won't become a 200 on retry
  });
}
