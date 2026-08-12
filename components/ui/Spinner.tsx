import { Activity } from "lucide-react";

// Custom loading indicator — a pulsing heartbeat icon, not the default
// Tailwind `animate-spin` circle (PRD Reference G calls that out explicitly
// as a "generic AI SaaS" tell to avoid). Animation is a plain scale/opacity
// pulse defined in globals.css (`.pulse-beat`).
export function Spinner({
  label = "Loading…",
  className = "",
}: Readonly<{ label?: string; className?: string }>) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} role="status">
      <Activity className="pulse-beat h-8 w-8 text-primary" strokeWidth={2} aria-hidden="true" />
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
