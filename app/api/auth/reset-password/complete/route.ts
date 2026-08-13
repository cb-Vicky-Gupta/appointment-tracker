import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import {
  hashPassword,
  issueTokens,
  revokeAllRefreshTokensForUser,
  setRefreshCookie,
  toPublicUser,
  verifyPasswordResetToken,
} from "@/lib/auth";
import { sendPasswordChangedEmail } from "@/lib/mailer";

// Step 3 of forgot-password: redeem the resetToken from .../verify-otp for
// the new password, update the account, and sign the user straight back in
// (same as signup's .../complete) — every other existing session gets
// signed out first, since an old refresh token shouldn't outlive the
// password change that was presumably prompted by losing control of it.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { resetToken, password } = parsed.data;

  const claims = await verifyPasswordResetToken(resetToken);
  if (!claims) return jsonError(401, "Reset link expired — please start again");

  const user = await prisma.user.findUnique({ where: { email: claims.email } });
  if (!user) return jsonError(404, "This account no longer exists");

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await revokeAllRefreshTokensForUser(user.id);

  const { accessToken, refreshToken } = await issueTokens(user.id);

  sendPasswordChangedEmail(user.email, user.name).catch((err) =>
    console.error("[mailer] password-changed notice failed:", err)
  );

  const res = NextResponse.json({ accessToken, refreshToken, user: toPublicUser(user) });
  setRefreshCookie(res, refreshToken);
  return res;
}
