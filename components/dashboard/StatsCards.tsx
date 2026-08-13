import type { ComponentType } from "react";
import { Spinner } from "@/components/ui/Spinner";

export interface StatCardConfig<T> {
  key: keyof T;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;
}

// Generic over the stats shape so it backs both the resident dashboard
// (lib/hooks/use-dashboard-stats.ts, 4 fields) and the admin overview
// (lib/hooks/use-admin-stats.ts, Plan Phase C — a different set of fields)
// — each page supplies its own `cards` config instead of this component
// hardcoding one shape. Not constrained to `Record<string, number>`: a
// concrete interface like DashboardStats has no index signature, so that
// constraint would reject every real caller — every value is rendered
// via `Number(...)` instead, since the numeric-fields contract is
// enforced by convention (every stats hook's fields are counts) rather
// than the type system here.
export function StatsCards<T extends object>({
  stats,
  isLoading,
  isError,
  cards,
}: Readonly<{
  stats: T | undefined;
  isLoading: boolean;
  isError: boolean;
  cards: Array<StatCardConfig<T>>;
}>) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-surface p-8">
        <Spinner label="Loading stats…" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <p className="rounded-lg border border-border bg-surface p-4 text-sm text-danger">
        Couldn&rsquo;t load stats.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon }) => (
        <div
          key={String(key)}
          className="rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-primary">
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-semibold tabular-nums">{Number(stats[key])}</p>
          <p className="mt-0.5 text-sm text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}
