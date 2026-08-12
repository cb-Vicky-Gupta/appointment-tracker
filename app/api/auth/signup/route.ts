import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import { hashPassword, issueTokens, setRefreshCookie, toPublicUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { name, email, password, gender } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError(409, "An account with this email already exists");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, gender },
  });

  const { accessToken, refreshToken } = await issueTokens(user.id);

  const res = NextResponse.json(
    { accessToken, refreshToken, user: toPublicUser(user) },
    { status: 201 }
  );
  setRefreshCookie(res, refreshToken);
  return res;
}
