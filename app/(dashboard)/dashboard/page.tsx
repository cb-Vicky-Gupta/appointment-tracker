"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRequireAuth } from "@/lib/use-require-auth";
import { AppHeader } from "@/components/layout/AppHeader";
import { Spinner } from "@/components/ui/Spinner";

// Placeholder — real dashboard stats land in Phase 8, sidebar layout in
// Phase 10. This page exists to prove the session survives a reload, logout
// works, and the theme repaints correctly for the signed-in user's gender.
export default function DashboardPage() {
  const { ready } = useRequireAuth();
  const { user } = useAuth();

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user?.name}</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as {user?.email} · theme follows your {user?.gender.toLowerCase()} palette
          </p>
        </div>

        <Link
          href="/patients"
          className="rounded-lg border border-border bg-surface p-6 transition-colors hover:border-primary"
        >
          <p className="font-medium">Go to your patients →</p>
          <p className="mt-1 text-sm text-muted">
            Search by name or OPD no. and see full appointment history. Dashboard stats and
            the prescription scanner land in later phases.
          </p>
        </Link>
      </main>
    </div>
  );
}
