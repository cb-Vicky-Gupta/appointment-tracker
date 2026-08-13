"use client";

import type { ReactNode } from "react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppShell } from "@/components/layout/AppShell";
import { DASHBOARD_NAV_LINKS } from "@/components/layout/nav-links";

// Phase 10 — sidebar dashboard shell (PRD Reference G), and the one place
// the "wait for session, then redirect if there isn't one" guard lives now.
// Every page under app/(dashboard)/* used to call useRequireAuth() itself and
// repeat an <AppHeader/> + loading branch (Phases 6-9) — hoisting it here
// means a page only renders once a session is confirmed. The shell itself
// (sidebar/drawer/collapse) is AppShell, shared with app/(admin)/admin/layout.tsx
// (Plan Phase C) — only the nav links and home link differ between the two.
export default function DashboardGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { ready } = useRequireAuth();

  return (
    <AppShell ready={ready} navLinks={DASHBOARD_NAV_LINKS} homeHref="/dashboard" showAdminLink>
      {children}
    </AppShell>
  );
}
