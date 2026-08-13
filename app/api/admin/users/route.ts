import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, toPublicUser } from "@/lib/auth";
import { unauthorized, forbidden, validationError } from "@/lib/api-response";
import { adminUserListQuerySchema } from "@/lib/validation";

const PAGE_SIZE = 20;

// GET /api/admin/users?search=&page= (Plan Phase B) — every registered
// account, paginated. Search matches name/email/institute, case-insensitive
// contains. Patient counts come from the User -> Patient relation's
// `_count` (one query, not one-count-per-row) — same "no N+1" discipline as
// GET /api/patients.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const parsed = adminUserListQuerySchema.safeParse({
    search: req.nextUrl.searchParams.get("search") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { search, page } = parsed.data;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { institute: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { patients: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users: users.map(({ _count, ...u }) => ({ ...toPublicUser(u), patientCount: _count.patients })),
    page,
    pageSize: PAGE_SIZE,
    total,
  });
}
