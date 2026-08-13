"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { fetchJson as parseJsonOrThrow } from "@/lib/fetch-json";
import type { PatientListItem } from "@/lib/hooks/use-patients";
import type { AppointmentRecord } from "@/lib/hooks/use-patient-detail";

export interface NewPatientInput {
  name: string;
  opdNo: string;
  age?: number;
  phone?: string;
  email?: string;
  address?: string;
  appointmentDate?: string;
  nextAppointmentDate?: string;
  notes?: string;
  ocrRawText?: string;
}

export interface NewAppointmentInput {
  appointmentDate?: string;
  nextAppointmentDate?: string;
  notes?: string;
  ocrRawText?: string;
}

// POST /api/patients — new patient + first visit together (Reference C).
// Invalidates the patient list so the new patient shows up immediately.
export function useCreatePatient() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewPatientInput) => {
      const res = await authFetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<{ patient: PatientListItem; appointment: AppointmentRecord }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

// POST /api/patients/:id/appointments — the "same patient comes again" path
// (Reference J: always an explicit, resident-confirmed choice, never a silent
// merge). Invalidates both the list (so lastVisitAt/visitCount refresh) and
// that patient's own detail query.
export function useAddAppointment(patientId: string) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewAppointmentInput) => {
      const res = await authFetch(`/api/patients/${patientId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return parseJsonOrThrow<{ appointment: AppointmentRecord }>(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
  });
}
