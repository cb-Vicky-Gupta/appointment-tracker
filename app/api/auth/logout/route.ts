import { NextRequest, NextResponse } from "next/server";
import { clearRefreshCookie, revokeRefreshToken, REFRESH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const refreshToken =
    (typeof body === "object" && body && "refreshToken" in body
      ? String((body as { refreshToken?: unknown }).refreshToken ?? "")
      : "") || req.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) await revokeRefreshToken(refreshToken);

  const res = NextResponse.json({ success: true });
  clearRefreshCookie(res);
  return res;
}
