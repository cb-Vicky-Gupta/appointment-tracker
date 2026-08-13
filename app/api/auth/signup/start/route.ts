import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSignupSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import { generateOtp, hashOtp, OTP_TTL_MS } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/mailer";

// Step 1 of signup: collect name/email/gender, email a 6-digit OTP. No User
// row is created here — that only happens in .../complete, once the OTP is
// verified and a password is chosen. Calling this again for the same email
// (a "resend") simply overwrites the previous pending OTP.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = startSignupSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { name, email, gender } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return jsonError(409, "An account with this email already exists");

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  await prisma.pendingSignup.upsert({
    where: { email },
    create: { email, name, gender, otpHash, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
    update: { name, gender, otpHash, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
  });

  try {
    await sendOtpEmail(email, name, otp);
  } catch {
    return jsonError(502, "Couldn't send the verification email — please try again");
  }

  return NextResponse.json({ message: "Verification code sent", email });
}
