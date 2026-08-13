import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized, validationError } from "@/lib/api-response";
import { appointmentExportQuerySchema } from "@/lib/validation";
import { toCsv } from "@/lib/csv";

// Same backstop as the admin export (Plan Phase D) — not a real pagination
// limit, just a ceiling so this can't try to stream an unbounded result.
const MAX_EXPORT_ROWS = 10_000;

const HEADERS = [
  "patientName",
  "opdNo",
  "age",
  "phone",
  "visitDate",
  "appointmentDate",
  "notes",
];

// dd-mm-yyyy, not an ISO timestamp: these are date-only values (both come
// from an <input type="date">, stored as UTC midnight) and the file is read
// by people, not machines. Read back in UTC for the same reason it's written
// that way — anything local-timezone would shift the day.
function formatDate(date: Date | null): string | null {
  if (!date) return null;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getUTCFullYear()}`;
}

// GET /api/patients/export?search= — every appointment across the caller's
// own patients (Reference D: scoped to userId, same as every other patient/
// appointment query), one row per visit, newest first. `search` matches the
// same name/OPD-prefix filter as GET /api/patients so a resident can export
// just the patients they're currently looking at.
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const parsed = appointmentExportQuerySchema.safeParse({
    search: req.nextUrl.searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { search } = parsed.data;

  const appointments = await prisma.appointment.findMany({
    where: {
      patient: {
        userId: auth.userId,
        ...(search
          ? {
              OR: [
                { opdNo: { startsWith: search } },
                { name: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
    },
    orderBy: { appointmentDate: "desc" },
    take: MAX_EXPORT_ROWS,
    include: { patient: true },
  });

  const csv = toCsv(
    HEADERS,
    appointments.map((a) => [
      a.patient.name,
      a.patient.opdNo,
      a.patient.age,
      a.patient.phone,
      formatDate(a.appointmentDate),
      formatDate(a.nextAppointmentDate),
      a.notes,
    ])
  );

  const filename = `ilazdoot-appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
