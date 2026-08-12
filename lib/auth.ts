import { randomBytes, createHash } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

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
