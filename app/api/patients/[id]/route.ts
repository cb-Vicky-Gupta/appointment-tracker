import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized, jsonError, validationError } from "@/lib/api-response";
import { findOwnedPatient } from "@/lib/patients";
import { appointmentListQuerySchema } from "@/lib/validation";

const APPOINTMENTS_PAGE_SIZE = 20;

// GET /api/patients/:id?page=&search= — patient + a page of its appointment
// history, newest first. The appointment list is paginated/searchable
// (matches free text in `notes`) same as the top-level patient list, since a
// long-tenured patient can accumulate many visits. 404 (not 403) when the
// patient doesn't exist OR belongs to another user — never reveal which
// (Reference D).
export async function GET(req: NextRequest, ctx: RouteContext<"/api/patients/[id]">) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const { id } = await ctx.params;
  const patient = await findOwnedPatient(auth.userId, id);
  if (!patient) return jsonError(404, "Patient not found");

  const parsed = appointmentListQuerySchema.safeParse({
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { search, page } = parsed.data;

  const where = {
    patientId: patient.id,
    ...(search ? { notes: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: "desc" },
      skip: (page - 1) * APPOINTMENTS_PAGE_SIZE,
      take: APPOINTMENTS_PAGE_SIZE,
    }),
    prisma.appointment.count({ where }),
  ]);

  return NextResponse.json({
    patient,
    appointments,
    appointmentsMeta: { page, pageSize: APPOINTMENTS_PAGE_SIZE, total },
  });
}
