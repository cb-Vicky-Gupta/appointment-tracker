import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized, validationError, jsonError } from "@/lib/api-response";
import { createPatientSchema, patientListQuerySchema } from "@/lib/validation";

const PAGE_SIZE = 20;

// GET /api/patients?search=&page=
// Matches opdNo by prefix/exact and name by case-insensitive contains
// (Reference: "Search" build notes) — always scoped to the caller's own
// patients (Reference D).
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const parsed = patientListQuerySchema.safeParse({
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { search, page } = parsed.data;

  const where = {
    userId: auth.userId,
    ...(search
      ? {
          OR: [
            { opdNo: { startsWith: search } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { appointments: true } },
        appointments: { orderBy: { appointmentDate: "desc" }, take: 1 },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return NextResponse.json({
    patients: patients.map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      opdNo: p.opdNo,
      phone: p.phone,
      email: p.email,
      address: p.address,
      visitCount: p._count.appointments,
      lastVisitAt: p.appointments[0]?.appointmentDate ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
  });
}

// POST /api/patients — creates a patient AND its first appointment together;
// there's no such thing as a patient with zero visits (Reference C). If the
// caller suspects this patient already exists (e.g. from a `GET
// /api/patients?search=` lookup), they should call
// `POST /api/patients/:id/appointments` on the existing patient instead — see
// Reference J. This route never merges into an existing patient itself.
export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { name, opdNo, age, phone, email, address, appointmentDate, notes, ocrRawText } =
    parsed.data;

  // One OPD No. can't belong to two different patients for the same user
  // (enforced at the DB level too — @@unique([userId, opdNo]) — this is
  // just what turns that constraint into a clear, actionable error instead
  // of a raw Prisma exception).
  const existing = await prisma.patient.findFirst({ where: { userId: auth.userId, opdNo } });
  if (existing) {
    return jsonError(
      409,
      `OPD No. ${opdNo} is already ${existing.name}'s — add a visit to that patient instead of creating a new one.`
    );
  }

  try {
    const { patient, appointment } = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: { userId: auth.userId, name, opdNo, age, phone, email, address },
      });
      const appointment = await tx.appointment.create({
        data: {
          patientId: patient.id,
          appointmentDate: appointmentDate ?? new Date(),
          notes,
          ocrRawText,
        },
      });
      return { patient, appointment };
    });

    return NextResponse.json({ patient, appointment }, { status: 201 });
  } catch (err) {
    // Two concurrent requests can both pass the pre-check above and race
    // each other here — the @@unique([userId, opdNo]) constraint is the
    // real guarantee, this just keeps that rare case's error just as
    // friendly as the common one caught earlier.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, `OPD No. ${opdNo} was just used by another request — please retry.`);
    }
    throw err;
  }
}
