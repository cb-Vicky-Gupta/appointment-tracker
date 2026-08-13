"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { fetchJson } from "@/lib/fetch-json";

export interface PatientListItem {
  id: string;
  name: string;
  age: number | null;
  opdNo: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PatientListResponse {
  patients: PatientListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export function usePatients(search: string, page: number) {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["patients", search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      const res = await authFetch(`/api/patients?${params.toString()}`);
      return fetchJson<PatientListResponse>(res);
    },
    placeholderData: (previous) => previous, // keep old results visible while a new page/search loads
  });
}
