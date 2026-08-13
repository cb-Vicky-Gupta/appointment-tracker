import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { unauthorized, forbidden, jsonError, validationError } from "@/lib/api-response";
import { patientListQuerySchema } from "@/lib/validation";

const PAGE_SIZE = 20;

// GET /api/admin/users/:id/patients?search=&page= — read-only visibility
// into one user's patient list, for support/oversight. Same shape/search as
// GET /api/patients, just scoped to `:id` (the admin's *own* patients are
// never mixed in here, and there's no POST/PATCH/DELETE on this route —
// admins can suspend/delete the *account*, Plan Phase B, but never touch
// another resident's patient records directly).
export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]/patients">) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return jsonError(404, "User not found");

  const parsed = patientListQuerySchema.safeParse({
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { search, page } = parsed.data;

  const where = {
    userId: id,
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
