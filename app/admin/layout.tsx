"use client";

import type { ReactNode } from "react";
import { useRequireAdmin } from "@/lib/use-require-admin";
import { AppShell } from "@/components/layout/AppShell";
import { ADMIN_NAV_LINKS } from "@/components/layout/nav-links";

// Admin panel (Plan Phase C). Mirrors app/(dashboard)/layout.tsx exactly,
// just with useRequireAdmin instead of useRequireAuth and the admin nav
// links — the actual shell (sidebar/drawer/collapse) is the shared
// AppShell, not duplicated here.
export default function AdminGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { ready } = useRequireAdmin();

  return (
    <AppShell ready={ready} navLinks={ADMIN_NAV_LINKS} homeHref="/admin">
      {children}
    </AppShell>
  );
}
