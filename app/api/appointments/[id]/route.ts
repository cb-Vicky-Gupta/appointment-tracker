import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { unauthorized, jsonError } from "@/lib/api-response";
import { findOwnedAppointment } from "@/lib/patients";

// GET /api/appointments/:id — single appointment detail, scoped through its
// patient's userId (Reference D).
export async function GET(req: NextRequest, ctx: RouteContext<"/api/appointments/[id]">) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const { id } = await ctx.params;
  const record = await findOwnedAppointment(auth.userId, id);
  if (!record) return jsonError(404, "Appointment not found");

  const { patient, ...appointment } = record;
  return NextResponse.json({ appointment, patient });
}
