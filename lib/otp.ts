import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

// Shared with lib/auth.ts's password hashing (same bcrypt cost); OTPs are
// short-lived and low-entropy on purpose (6 digits, human-typeable), so the
// real protection is the expiry + attempt cap enforced in the verify route,
// not the hash itself.
const BCRYPT_ROUNDS = 10;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_OTP_ATTEMPTS = 5;

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

export function verifyOtp(otp: string, otpHash: string): Promise<boolean> {
  return bcrypt.compare(otp, otpHash);
}
