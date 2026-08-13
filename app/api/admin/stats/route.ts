import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/api-response";
import { getTodayRange, getThisWeekRange } from "@/lib/date-ranges";

// GET /api/admin/stats -> platform-wide numbers (Plan Phase B), the admin
// equivalent of GET /api/dashboard/stats — same "parallel indexed count()s,
// not fetch-all-and-count-in-JS" approach, just unscoped by userId.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const today = getTodayRange();
  const thisWeek = getThisWeekRange();

  const [
    totalUsers,
    totalPatients,
    totalAppointments,
    signupsToday,
    signupsThisWeek,
    suspendedUsers,
    adminUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.patient.count(),
    prisma.appointment.count(),
    prisma.user.count({ where: { createdAt: { gte: today.start, lt: today.end } } }),
    prisma.user.count({ where: { createdAt: { gte: thisWeek.start, lt: thisWeek.end } } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalPatients,
    totalAppointments,
    signupsToday,
    signupsThisWeek,
    suspendedUsers,
    adminUsers,
  });
}
