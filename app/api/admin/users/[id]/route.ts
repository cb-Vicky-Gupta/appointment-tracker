import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, revokeAllRefreshTokensForUser, toPublicUser } from "@/lib/auth";
import { unauthorized, forbidden, jsonError, validationError } from "@/lib/api-response";
import { adminUpdateUserSchema } from "@/lib/validation";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/users/:id (Plan Phase B) — full profile + activity counts.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { patients: true, refreshTokens: true } } },
  });
  if (!user) return jsonError(404, "User not found");

  const totalAppointments = await prisma.appointment.count({ where: { patient: { userId: id } } });

  const { _count, ...u } = user;
  return NextResponse.json({
    user: {
      ...toPublicUser(u),
      patientCount: _count.patients,
      appointmentCount: totalAppointments,
      activeSessionCount: _count.refreshTokens,
    },
  });
}

// PATCH /api/admin/users/:id — one action per call: suspend/reactivate,
// change role, or force-logout. Every branch is logged to AdminAction
// (Plan Phase B) *after* it succeeds. An admin can never target their own
// account here — suspending/demoting/force-logging-out yourself is either a
// lockout risk or pointless, so it's simply not allowed rather than needing
// a "are you sure" dance.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const { id } = await ctx.params;
  if (id === admin.user.id) {
    return jsonError(400, "You can't perform admin actions on your own account");
  }

  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = adminUpdateUserSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { status, role, forceLogout } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return jsonError(404, "User not found");

  const adminActor = { id: admin.user.id, email: admin.user.email };
  const targetActor = { id: target.id, email: target.email };

  if (status && status !== target.status) {
    await prisma.user.update({ where: { id }, data: { status } });
    // Suspending kills their session immediately, not just on their next
    // refresh (the refresh route's own status check, Plan Phase A, is the
    // backstop for anyone who slips in between).
    if (status === "SUSPENDED") await revokeAllRefreshTokensForUser(id);
    await logAdminAction({
      admin: adminActor,
      action: status === "SUSPENDED" ? "SUSPEND" : "REACTIVATE",
      target: targetActor,
    });
  }

  if (role && role !== target.role) {
    await prisma.user.update({ where: { id }, data: { role } });
    await logAdminAction({
      admin: adminActor,
      action: "ROLE_CHANGE",
      target: targetActor,
      detail: `${target.role} -> ${role}`,
    });
  }

  if (forceLogout) {
    await revokeAllRefreshTokensForUser(id);
    await logAdminAction({ admin: adminActor, action: "FORCE_LOGOUT", target: targetActor });
  }

  const updated = await prisma.user.findUnique({ where: { id } });
  return NextResponse.json({ user: toPublicUser(updated!) });
}

// DELETE /api/admin/users/:id — hard delete. Cascades to their
// patients/appointments/refreshTokens (existing onDelete: Cascade relations)
// — this is the most dangerous route in the app, so it's logged with a
// snapshot of what was removed even though the row itself is gone
// afterward.
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  const { id } = await ctx.params;
  if (id === admin.user.id) {
    return jsonError(400, "You can't delete your own account here");
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { patients: true } } },
  });
  if (!target) return jsonError(404, "User not found");

  await prisma.user.delete({ where: { id } });

  await logAdminAction({
    admin: { id: admin.user.id, email: admin.user.email },
    action: "DELETE_USER",
    target: { id: target.id, email: target.email },
    detail: `name="${target.name}", ${target._count.patients} patient(s) deleted with them`,
  });

  return NextResponse.json({ message: `${target.email} deleted` });
}
