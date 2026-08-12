import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import {
  issueTokens,
  setRefreshCookie,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  // Deliberately identical error for "no such user" and "wrong password" —
  // don't let the response shape reveal which emails are registered.
  if (!user || !passwordOk) return jsonError(401, "Invalid email or password");

  const { accessToken, refreshToken } = await issueTokens(user.id);

  const res = NextResponse.json({ accessToken, refreshToken, user: toPublicUser(user) });
  setRefreshCookie(res, refreshToken);
  return res;
}
