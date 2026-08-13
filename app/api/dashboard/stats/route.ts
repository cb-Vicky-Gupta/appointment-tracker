import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";

// GET /api/dashboard/stats -> { totalPatients, totalAppointments,
// todayAppointments, thisWeekAppointments }, scoped to the caller's own data
// (Reference D). Four `count()` calls run concurrently rather than fetching
// every patient/appointment row and counting in JS — each hits an indexed
// column (`userId` on Patient, `patientId`/date range on Appointment via the
// nested `patient.userId` relation filter).
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // Week starts Monday. getDay(): 0=Sun..6=Sat -> days since Monday.
  const daysSinceMonday = (startOfToday.getDay() + 6) % 7;
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  const startOfNextWeek = new Date(startOfWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const [totalPatients, totalAppointments, todayAppointments, thisWeekAppointments] =
    await Promise.all([
      prisma.patient.count({ where: { userId: auth.userId } }),
      prisma.appointment.count({ where: { patient: { userId: auth.userId } } }),
      prisma.appointment.count({
        where: {
          patient: { userId: auth.userId },
          appointmentDate: { gte: startOfToday, lt: startOfTomorrow },
        },
      }),
      prisma.appointment.count({
        where: {
          patient: { userId: auth.userId },
          appointmentDate: { gte: startOfWeek, lt: startOfNextWeek },
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
