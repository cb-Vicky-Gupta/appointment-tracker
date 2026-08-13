import { prisma } from "@/lib/prisma";

export type AdminActionType = "SUSPEND" | "REACTIVATE" | "FORCE_LOGOUT" | "ROLE_CHANGE" | "DELETE_USER";

/** Records one row per consequential admin action (Plan Phase B) — call
 *  this *after* the action itself succeeds, never before, so a failed
 *  action never gets logged as having happened. */
export function logAdminAction(input: {
  admin: { id: string; email: string };
  action: AdminActionType;
  target: { id: string; email: string };
  detail?: string;
}) {
  return prisma.adminAction.create({
    data: {
      adminId: input.admin.id,
      adminEmail: input.admin.email,
      action: input.action,
      targetUserId: input.target.id,
      targetEmail: input.target.email,
      detail: input.detail,
    },
  });
}
