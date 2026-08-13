import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { unauthorized, forbidden, validationError } from "@/lib/api-response";
import { adminUserExportQuerySchema } from "@/lib/validation";
import { toCsv } from "@/lib/csv";

// A sane ceiling so one export can't accidentally try to stream an
// unbounded table — well above any realistic PG-cohort size, just a
// backstop, not a real pagination limit like the list endpoint has.
const MAX_EXPORT_ROWS = 10_000;

const HEADERS = [
  "id",
  "name",
  "email",
  "gender",
  "role",
  "status",
  "specialization",
  "institute",
  "studentType",
  "year",
  "phone",
  "patientCount",
  "createdAt",
];

// GET /api/admin/users/export?search= (Plan Phase D) — a CSV of every
// matching account, same search as GET /api/admin/users but unpaginated:
// the export is the whole matching set in one file.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const parsed = adminUserExportQuerySchema.safeParse({
    search: req.nextUrl.searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { search } = parsed.data;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { institute: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
    include: { _count: { select: { patients: true } } },
  });

  const csv = toCsv(
    HEADERS,
    users.map((u) => [
      u.id,
      u.name,
      u.email,
      u.gender,
      u.role,
      u.status,
      u.specialization,
      u.institute,
      u.studentType,
      u.year,
      u.phone,
      u._count.patients,
      u.createdAt.toISOString(),
    ])
  );

  const filename = `ilazdoot-users-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
