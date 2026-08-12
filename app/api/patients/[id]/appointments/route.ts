import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized, jsonError, validationError } from "@/lib/api-response";
import { findOwnedPatient } from "@/lib/patients";
import { createAppointmentSchema } from "@/lib/validation";

// POST /api/patients/:id/appointments — the "same patient comes again" path.
// Always `create`, never `update`: a returning visit adds a new Appointment
// row and the old ones stay exactly as they were (Reference A's key design
// point, and Reference J — this route is never called silently; the caller
// decided this is the same patient, whether via manual search or an accepted
// OCR match suggestion).
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/patients/[id]/appointments">
) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const { id } = await ctx.params;
  const patient = await findOwnedPatient(auth.userId, id);
  if (!patient) return jsonError(404, "Patient not found");

  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { appointmentDate, notes, ocrRawText } = parsed.data;

  const appointment = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.create({
      data: {
        patientId: patient.id,
        appointmentDate: appointmentDate ?? new Date(),
        notes,
        ocrRawText,
      },
    });
    // Touch the patient so patient lists (sorted by most-recently-active,
    // see GET /api/patients) surface this visit without a separate query.
    await tx.patient.update({ where: { id: patient.id }, data: {} });
    return appointment;
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
