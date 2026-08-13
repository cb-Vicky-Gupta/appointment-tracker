import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeSignupSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import {
  hashPassword,
  issueTokens,
  setRefreshCookie,
  toPublicUser,
  verifySignupToken,
} from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/mailer";

// Step 3 of signup: redeem the signupToken from .../verify-otp for the
// password the user just chose, and only now create the actual User row.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = completeSignupSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { signupToken, password } = parsed.data;

  const claims = await verifySignupToken(signupToken);
  if (!claims) return jsonError(401, "Verification expired — please start signup again");

  // Race guard: another request could have created this account between
  // step 2 and step 3 (e.g. a double-submitted tab).
  const existing = await prisma.user.findUnique({ where: { email: claims.email } });
  if (existing) return jsonError(409, "An account with this email already exists");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: claims.name, email: claims.email, passwordHash, gender: claims.gender },
  });

  const { accessToken, refreshToken } = await issueTokens(user.id);

  // Best-effort — a welcome email failing to send shouldn't fail account
  // creation; the user already has real tokens at this point.
  sendWelcomeEmail(user.email, user.name).catch((err) =>
    console.error("[mailer] welcome email failed:", err)
  );

  const res = NextResponse.json(
    { accessToken, refreshToken, user: toPublicUser(user) },
    { status: 201 }
  );
  setRefreshCookie(res, refreshToken);
  return res;
}
