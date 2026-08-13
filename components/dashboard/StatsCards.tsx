import { CalendarCheck, CalendarRange, ClipboardList, Users } from "lucide-react";
import type { DashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { Spinner } from "@/components/ui/Spinner";

const CARDS: Array<{
  key: keyof DashboardStats;
  label: string;
  icon: typeof Users;
}> = [
  { key: "totalPatients", label: "Total patients", icon: Users },
  { key: "totalAppointments", label: "Total visits logged", icon: ClipboardList },
  { key: "todayAppointments", label: "Today's visits", icon: CalendarCheck },
  { key: "thisWeekAppointments", label: "This week's visits", icon: CalendarRange },
];

export function StatsCards({
  stats,
  isLoading,
  isError,
}: Readonly<{ stats: DashboardStats | undefined; isLoading: boolean; isError: boolean }>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-8">
        <Spinner label="Loading your stats…" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-danger">
        Couldn&rsquo;t load your stats.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon }) => (
        <div
          key={key}
          className="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-primary">
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-semibold tabular-nums">{stats[key]}</p>
          <p className="mt-0.5 text-sm text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}
