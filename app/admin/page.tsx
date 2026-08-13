"use client";

import { AlertTriangle, CalendarPlus, ClipboardList, ShieldCheck, Users, UserSquare2 } from "lucide-react";
import { useAdminStats, type AdminStats } from "@/lib/hooks/use-admin-stats";
import { StatsCards, type StatCardConfig } from "@/components/dashboard/StatsCards";

const STAT_CARDS: Array<StatCardConfig<AdminStats>> = [
  { key: "totalUsers", label: "Total accounts", icon: Users },
  { key: "totalPatients", label: "Patients logged (all users)", icon: UserSquare2 },
  { key: "totalAppointments", label: "Visits logged (all users)", icon: ClipboardList },
  { key: "signupsToday", label: "Signups today", icon: CalendarPlus },
  { key: "signupsThisWeek", label: "Signups this week", icon: CalendarPlus },
  { key: "suspendedUsers", label: "Suspended accounts", icon: AlertTriangle },
  { key: "adminUsers", label: "Admins", icon: ShieldCheck },
];

// Admin panel overview (Plan Phase C). Auth-gating + chrome live in
// app/admin/layout.tsx.
export default function AdminOverviewPage() {
  const { data: stats, isLoading, isError } = useAdminStats();

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <div>
        <h1 className="text-2xl font-semibold">Admin overview</h1>
        <p className="mt-1 text-sm text-muted">Platform-wide numbers, across every resident&rsquo;s account.</p>
      </div>

      <StatsCards stats={stats} isLoading={isLoading} isError={isError} cards={STAT_CARDS} />
    </main>
  );
}
