"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth, type Gender } from "@/lib/auth-context";
import { fetchJson } from "@/lib/fetch-json";

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  gender: Gender;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  specialization: string | null;
  institute: string | null;
  studentType: string | null;
  year: string | null;
  phone: string | null;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminUserListResponse {
  users: AdminUserListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export function useAdminUsers(search: string, page: number) {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      const res = await authFetch(`/api/admin/users?${params.toString()}`);
      return fetchJson<AdminUserListResponse>(res);
    },
    placeholderData: (previous) => previous,
  });
}
