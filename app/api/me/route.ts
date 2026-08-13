import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, toPublicUser } from "@/lib/auth";
import { unauthorized, jsonError, validationError } from "@/lib/api-response";
import { updateMeSchema } from "@/lib/validation";

// Also the protected route used to smoke-test the Phase 2 auth flow end-to-end.
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return unauthorized();

  return NextResponse.json({ user: toPublicUser(user) });
}

// PATCH /api/me — profile editing (Phase 9). `gender`/`themeMode` are exactly
// the two fields ThemeProvider (Reference F) keys off, so this is also the
// one place a user's theme actually gets persisted.
export async function PATCH(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const user = await prisma.user.update({ where: { id: auth.userId }, data: parsed.data });
  return NextResponse.json({ user: toPublicUser(user) });
}
