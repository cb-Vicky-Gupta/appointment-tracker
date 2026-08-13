"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Guard for everything under app/(dashboard)/* — redirects to /login once
// the session check resolves to "no session", and tells the caller whether
// it's safe to render yet. Called once, from app/(dashboard)/layout.tsx
// (Phase 10) rather than by each page individually.
export function useRequireAuth() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  return { ready: status === "authenticated", user };
}
