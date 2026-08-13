import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { unauthorized, forbidden } from "@/lib/api-response";

// Admin panel Plan Phase A — a stub proving requireAdmin actually gates
// something end-to-end before Phase B builds real admin routes behind it.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin.outcome === "unauthenticated") return unauthorized();
  if (admin.outcome === "forbidden") return forbidden();

  return NextResponse.json({ message: `Hello, admin ${admin.user.name}` });
}
