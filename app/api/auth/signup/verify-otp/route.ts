import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtpSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import { verifyOtp as compareOtp, MAX_OTP_ATTEMPTS } from "@/lib/otp";
import { signSignupToken } from "@/lib/auth";

// Step 2 of signup: redeem the OTP emailed in step 1 for a short-lived
// signupToken (step 3 exchanges that + a password for a real account). The
// PendingSignup row is deleted the moment its OTP is correctly verified, so
// each code is usable exactly once.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { email, otp } = parsed.data;

  const pending = await prisma.pendingSignup.findUnique({ where: { email } });
  if (!pending) return jsonError(400, "No verification in progress for this email — start again");

  if (pending.otpExpiresAt < new Date()) {
    await prisma.pendingSignup.delete({ where: { email } }).catch(() => {});
    return jsonError(400, "That code has expired — request a new one");
  }

  if (pending.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.pendingSignup.delete({ where: { email } }).catch(() => {});
    return jsonError(429, "Too many incorrect attempts — request a new code");
  }

  const ok = await compareOtp(otp, pending.otpHash);
  if (!ok) {
    await prisma.pendingSignup.update({
      where: { email },
      data: { attempts: pending.attempts + 1 },
    });
    return jsonError(401, "Incorrect code");
  }

  await prisma.pendingSignup.delete({ where: { email } }).catch(() => {});

  const signupToken = await signSignupToken({
    email: pending.email,
    name: pending.name,
    gender: pending.gender,
  });

  return NextResponse.json({ signupToken });
}
