import { randomBytes, createHash } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Gender, User } from "@/lib/generated/prisma/client";

// --- Config -----------------------------------------------------------

const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 10;
const REFRESH_COOKIE_NAME = "refreshToken";
const ACCESS_COOKIE_NAME = "accessToken"; // fallback only, see getUserFromRequest

function getAccessTokenSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

// --- Passwords ----------------------------------------------------------

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// --- Access tokens (short-lived JWT, contains { userId }) ---------------

export interface AccessTokenPayload extends JWTPayload {
  userId: string;
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getAccessTokenSecret());
}

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessTokenSecret());
    if (typeof payload.userId !== "string") return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

// --- Signup tokens (short-lived JWT proving "this email just verified an
// OTP", issued by /api/auth/signup/verify-otp and redeemed by
// /api/auth/signup/complete) ---------------------------------------------
// Carries the details collected in step 1 (name/gender) so the "set
// password" step doesn't have to re-ask for them or re-touch the DB. Reuses
// the access-token secret — the `purpose` claim keeps it from being usable
// as (or confused with) a real access token.

const SIGNUP_TOKEN_TTL = "15m";

export interface SignupTokenPayload extends JWTPayload {
  purpose: "signup";
  email: string;
  name: string;
  gender: Gender;
}

export async function signSignupToken(input: {
  email: string;
  name: string;
  gender: Gender;
}): Promise<string> {
  return new SignJWT({ purpose: "signup", ...input })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SIGNUP_TOKEN_TTL)
    .sign(getAccessTokenSecret());
}

export async function verifySignupToken(token: string): Promise<SignupTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessTokenSecret());
    if (
      payload.purpose !== "signup" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.gender !== "string"
    ) {
      return null;
    }
    return payload as SignupTokenPayload;
  } catch {
    return null;
  }
}

// --- Password-reset tokens (short-lived JWT proving "this email just
// verified a reset OTP", issued by /api/auth/reset-password/verify-otp and
// redeemed by /api/auth/reset-password/complete) — mirrors signup tokens
// above, just without name/gender since the account already exists. -----

const RESET_TOKEN_TTL = "15m";

export interface PasswordResetTokenPayload extends JWTPayload {
  purpose: "password-reset";
  email: string;
}

export async function signPasswordResetToken(email: string): Promise<string> {
  return new SignJWT({ purpose: "password-reset", email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(RESET_TOKEN_TTL)
    .sign(getAccessTokenSecret());
}

export async function verifyPasswordResetToken(
  token: string
): Promise<PasswordResetTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessTokenSecret());
    if (payload.purpose !== "password-reset" || typeof payload.email !== "string") {
      return null;
    }
    return payload as PasswordResetTokenPayload;
  } catch {
    return null;
  }
}

// --- Refresh tokens (opaque random string, stored hashed in the DB) -----
// bcrypt is deliberately NOT used here: refresh tokens are high-entropy
// random strings (not user-chosen passwords), and we need to look them up
// by exact hash match on `refresh`, which bcrypt's per-call salt doesn't
// support. SHA-256 is fine for this — the token's own randomness is what
// makes it unguessable.

export function generateRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// --- Reading the current user off a request ------------------------------
// Must work identically for:
//   - web: fetch() calls that attach `Authorization: Bearer <accessToken>`
//     (the access token itself lives in memory in a React context, never a
//     cookie — but we still fall back to a cookie so SSR/other flows can work)
//   - mobile: `Authorization: Bearer <accessToken>` from secure storage
// Header is checked first, cookie second — never trust anything else.

export async function getUserFromRequest(
  req: NextRequest
): Promise<AccessTokenPayload | null> {
  const authHeader = req.headers.get("authorization");
  const headerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  const token = headerToken ?? req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;

  return verifyAccessToken(token);
}

export type RequireAdminResult =
  | { outcome: "unauthenticated" }
  | { outcome: "forbidden" }
  | { outcome: "ok"; user: User };

/** Admin-panel gate (Plan Phase A). Every `/api/admin/*` route calls this
 *  instead of `getUserFromRequest` — it does the same bearer-token check
 *  *and* loads the user row to confirm `role === "ADMIN"`, so a valid
 *  access token alone is never enough to reach an admin route. Returns which
 *  of the two failure modes happened so the route can 401 vs 403 correctly,
 *  same convention as every other protected route in the app. There is no
 *  way to become an admin through the API — see scripts/grant-admin.mjs. */
export async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const auth = await getUserFromRequest(req);
  if (!auth) return { outcome: "unauthenticated" };

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user || user.role !== "ADMIN") return { outcome: "forbidden" };

  return { outcome: "ok", user };
}

export { REFRESH_COOKIE_NAME };

// --- Issuing / revoking a token pair, tied to the RefreshToken table -----

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function issueTokens(userId: string): Promise<TokenPair> {
  const accessToken = await signAccessToken(userId);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      token: hashRefreshToken(refreshToken),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

/** Looks up a presented refresh token, returning its DB row if it's valid
 *  and not expired. Expired rows are deleted on the way out. */
export async function findValidRefreshToken(rawToken: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { token: hashRefreshToken(rawToken) },
  });
  if (!record) return null;

  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => {
      // already gone — fine, another request may have deleted it first
    });
    return null;
  }

  return record;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token: hashRefreshToken(rawToken) },
  });
}

/** Signs out every other session for this user — used after a password
 *  reset, since anyone still holding an old refresh token shouldn't stay
 *  logged in once the password that would've protected it has changed. */
export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// --- Serialization --------------------------------------------------------

export function toPublicUser(user: User) {
  const publicUser: Partial<User> = { ...user };
  delete publicUser.passwordHash;
  return publicUser;
}

// --- Cookies --------------------------------------------------------------
// The refresh token is set as an httpOnly cookie for the web client. It's
// also returned in the JSON body (see toPublicUser callers) so a mobile
// client — which has no concept of browser cookies — can store it itself.

export function setRefreshCookie(res: NextResponse, refreshToken: string) {
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });
}

export function clearRefreshCookie(res: NextResponse) {
  res.cookies.delete(REFRESH_COOKIE_NAME);
}
