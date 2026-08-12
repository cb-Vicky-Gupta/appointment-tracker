import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, toPublicUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";

// Minimal read-only stub for now — this is also the protected route used to
// smoke-test the Phase 2 auth flow end-to-end. PATCH (profile editing) lands
// in Phase 9.
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return unauthorized();

  return NextResponse.json({ user: toPublicUser(user) });
}
