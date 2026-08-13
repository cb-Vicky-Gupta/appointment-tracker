import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtpSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import { verifyOtp as compareOtp, MAX_OTP_ATTEMPTS } from "@/lib/otp";
import { signPasswordResetToken } from "@/lib/auth";

// Step 2 of forgot-password — same shape/logic as signup's verify-otp
// (app/api/auth/signup/verify-otp), just against the PasswordReset table and
// issuing a password-reset-purpose token instead of a signup one.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { email, otp } = parsed.data;

  const pending = await prisma.passwordReset.findUnique({ where: { email } });
  if (!pending) return jsonError(400, "No reset in progress for this email — start again");

  if (pending.otpExpiresAt < new Date()) {
    await prisma.passwordReset.delete({ where: { email } }).catch(() => {});
    return jsonError(400, "That code has expired — request a new one");
  }

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.passwordReset.delete({ where: { email } }).catch(() => {});
    return jsonError(429, "Too many incorrect attempts — request a new code");
  }

  const ok = await compareOtp(otp, pending.otpHash);
  if (!ok) {
    await prisma.passwordReset.update({
      where: { email },
      data: { attempts: pending.attempts + 1 },
    });
    return jsonError(401, "Incorrect code");
  }

  await prisma.passwordReset.delete({ where: { email } }).catch(() => {});

  const resetToken = await signPasswordResetToken(pending.email);
  return NextResponse.json({ resetToken });
}
