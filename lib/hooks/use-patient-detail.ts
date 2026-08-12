"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import type { PatientListItem } from "@/lib/hooks/use-patients";

export interface AppointmentRecord {
  id: string;
  patientId: string;
  appointmentDate: string;
  notes: string | null;
  ocrRawText: string | null;
  createdAt: string;
}

interface PatientDetailResponse {
  patient: PatientListItem & { userId: string };
  appointments: AppointmentRecord[];
  appointmentsMeta: { page: number; pageSize: number; total: number };
}

export function usePatientDetail(patientId: string, appointmentsSearch: string, appointmentsPage: number) {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ["patient", patientId, appointmentsSearch, appointmentsPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appointmentsSearch) params.set("search", appointmentsSearch);
      params.set("page", String(appointmentsPage));
      const res = await authFetch(`/api/patients/${patientId}?${params.toString()}`);
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json() as Promise<PatientDetailResponse>;
    },
    enabled: Boolean(patientId),
    retry: false, // a 404 won't become a 200 on retry
    placeholderData: (previous) => previous,
  });
}
