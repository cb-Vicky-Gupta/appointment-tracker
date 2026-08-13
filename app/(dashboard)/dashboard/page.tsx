"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarRange, ClipboardList, ScanLine, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useDashboardStats, type DashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { StatsCards, type StatCardConfig } from "@/components/dashboard/StatsCards";

const STAT_CARDS: Array<StatCardConfig<DashboardStats>> = [
  { key: "totalPatients", label: "Total patients", icon: Users },
  { key: "totalAppointments", label: "Total visits logged", icon: ClipboardList },
  { key: "todayAppointments", label: "Today's visits", icon: CalendarCheck },
  { key: "thisWeekAppointments", label: "This week's visits", icon: CalendarRange },
];

const QUICK_ACTIONS = [
  {
    href: "/patients/new",
    icon: ScanLine,
    title: "Add today's patient",
    description: "Scan a prescription or type the details in — every field stays editable.",
  },
  {
    href: "/patients",
    icon: Users,
    title: "Browse your patients",
    description: "Search by name or OPD no. and see each patient's full visit history.",
  },
] as const;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Auth-gating + chrome (sidebar/mobile top bar, Phase 10) now live in
// app/(dashboard)/layout.tsx — this only renders once a session is
// confirmed, so `user` below is never null.
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading, isError } = useDashboardStats();
  const firstName = user?.name.split(" ")[0];

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-10 md:px-10">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting()}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">Here&rsquo;s how your patient log looks today.</p>
      </div>

      <StatsCards stats={stats} isLoading={isLoading} isError={isError} cards={STAT_CARDS} />

      <div>
        <h2 className="text-sm font-medium text-muted">Quick actions</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {QUICK_ACTIONS.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 rounded-lg border border-border bg-surface p-6 transition-colors hover:border-primary"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-primary">
                <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  {title}
                  <ArrowRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </p>
                <p className="mt-1 text-sm text-muted">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
