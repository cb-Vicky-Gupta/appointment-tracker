import { prisma } from "@/lib/prisma";

// Per-user data isolation (PRD Reference D): every patient/appointment query
// must be scoped to the requesting user. These two helpers are the only
// places that should ever look up a Patient/Appointment by bare id — route
// handlers call through here instead of `prisma.patient.findUnique` directly,
// so there's one place enforcing the rule instead of N.

/** Returns the patient only if it belongs to `userId`; null otherwise
 *  (deliberately the same null for "doesn't exist" and "belongs to someone
 *  else" — never leak which one it was). */
export function findOwnedPatient(userId: string, patientId: string) {
  return prisma.patient.findFirst({ where: { id: patientId, userId } });
}

/** Same ownership guarantee, one hop over the Appointment -> Patient relation. */
export function findOwnedAppointment(userId: string, appointmentId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { userId } },
    include: { patient: true },
  });
}
