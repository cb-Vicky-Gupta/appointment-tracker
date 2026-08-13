import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import {
  findValidRefreshToken,
  revokeRefreshToken,
  signAccessToken,
  REFRESH_COOKIE_NAME,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Web sends the refresh token via the httpOnly cookie automatically; a
  // mobile client has no cookie jar and must send it explicitly in the body.
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const refreshToken =
    (typeof body === "object" && body && "refreshToken" in body
      ? String((body as { refreshToken?: unknown }).refreshToken ?? "")
      : "") || req.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) return jsonError(400, "refreshToken is required");

  const record = await findValidRefreshToken(refreshToken);
  if (!record) return jsonError(401, "Refresh token is invalid or expired");

  // Re-checked here, not just at login: an admin suspending an account
  // (Plan Phase B) should end that account's session on its very next
  // refresh, not just block future logins. Also revoke the token itself
  // outright, rather than leaving it valid until its 30-day expiry.
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || user.status === "SUSPENDED") {
    await revokeRefreshToken(refreshToken);
    return jsonError(403, "This account has been suspended");
  }

  const accessToken = await signAccessToken(record.userId);
  return NextResponse.json({ accessToken });
}
