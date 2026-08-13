"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { DASHBOARD_NAV_LINKS } from "@/components/layout/nav-links";

// Phase 10 — sidebar dashboard shell (PRD Reference G), and the one place
// the "wait for session, then redirect if there isn't one" guard lives now.
// Every page under app/(dashboard)/* used to call useRequireAuth() itself and
// repeat an <AppHeader/> + loading branch (Phases 6-9) — hoisting it here
// means a page only renders once a session is confirmed. The shell itself
// (sidebar/drawer/collapse) is AppShell, shared with app/admin/layout.tsx
// (Plan Phase C) — only the nav links and home link differ between the two.
//
// An ADMIN-role account is redirected off /dashboard and /patients* — those
// pages assume "your own patient log", which a pure admin account has none
// of (this was showing an admin an empty, confusing Patients CRUD page that
// looked like it might be everyone's data, when it's actually just their
// own, always-empty list — see Sidebar's matching nav-link rule). /profile
// stays reachable either way.
export default function DashboardGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { ready } = useRequireAuth();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const redirectingAdmin =
    ready && user?.role === "ADMIN" && (pathname === "/dashboard" || pathname.startsWith("/patients"));

  useEffect(() => {
    if (redirectingAdmin) router.replace("/admin");
  }, [redirectingAdmin, router]);

  return (
    <AppShell ready={ready && !redirectingAdmin} navLinks={DASHBOARD_NAV_LINKS} homeHref="/dashboard">
      {children}
    </AppShell>
  );
}
