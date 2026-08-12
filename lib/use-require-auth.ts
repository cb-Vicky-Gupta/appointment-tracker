"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Shared guard for every page under app/(dashboard)/* — redirects to /login
// once the session check resolves to "no session", and tells the caller
// whether it's safe to render the real page yet.
export function useRequireAuth() {
  const { user, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  return { ready: status === "authenticated", user };
}
