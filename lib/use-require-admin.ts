"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Guard for everything under app/(admin)/admin/* (Plan Phase C) — same idea
// as useRequireAuth, plus a role check: unauthenticated goes to /login (same
// as everywhere else), authenticated-but-not-admin goes to /dashboard rather
// than a bare "forbidden" page. This is a UX redirect only — every real
// admin API route re-checks `role` server-side via requireAdmin
// (lib/auth.ts); hiding a nav link or bouncing a page here is not itself a
// security boundary.
export function useRequireAdmin() {
  const { user, status } = useAuth();
  const router = useRouter();
  const isAdmin = status === "authenticated" && user?.role === "ADMIN";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "authenticated" && user?.role !== "ADMIN") router.replace("/dashboard");
  }, [status, user, router]);

  return { ready: isAdmin, user };
}
