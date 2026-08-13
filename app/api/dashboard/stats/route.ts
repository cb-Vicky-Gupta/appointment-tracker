import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { getTodayRange, getThisWeekRange } from "@/lib/date-ranges";

// GET /api/dashboard/stats -> { totalPatients, totalAppointments,
// todayAppointments, thisWeekAppointments }, scoped to the caller's own data
// (Reference D). Four `count()` calls run concurrently rather than fetching
// every patient/appointment row and counting in JS — each hits an indexed
// column (`userId` on Patient, `patientId`/date range on Appointment via the
// nested `patient.userId` relation filter).
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const today = getTodayRange();
  const thisWeek = getThisWeekRange();

  const [totalPatients, totalAppointments, todayAppointments, thisWeekAppointments] =
    await Promise.all([
      prisma.patient.count({ where: { userId: auth.userId } }),
      prisma.appointment.count({ where: { patient: { userId: auth.userId } } }),
      prisma.appointment.count({
        where: {
          patient: { userId: auth.userId },
          appointmentDate: { gte: today.start, lt: today.end },
        },
      }),
      prisma.appointment.count({
        where: {
          patient: { userId: auth.userId },
          appointmentDate: { gte: thisWeek.start, lt: thisWeek.end },
        },
      }),
    ]);

  return NextResponse.json({
    totalPatients,
    totalAppointments,
    todayAppointments,
    thisWeekAppointments,
  });
}
