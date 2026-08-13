import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { jsonError, validationError } from "@/lib/api-response";
import { generateOtp, hashOtp, OTP_TTL_MS } from "@/lib/otp";
import { sendPasswordResetOtpEmail } from "@/lib/mailer";

// Step 1 of forgot-password. Deliberately returns the exact same response
// whether or not the email is registered (same spirit as login's identical
// "Invalid email or password" for both "no such user" and "wrong password")
// — only a real account actually gets an OTP row + email sent.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null) return jsonError(400, "Invalid JSON body");

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await prisma.passwordReset.upsert({
      where: { email },
      create: { email, otpHash, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
      update: { otpHash, otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
    });

    try {
      await sendPasswordResetOtpEmail(email, user.name, otp);
    } catch {
      return jsonError(502, "Couldn't send the verification email — please try again");
    }
  }

  return NextResponse.json({ message: "If that email has an account, a code was sent to it" });
}
