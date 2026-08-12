import { Activity } from "lucide-react";

// App logo mark: a Lucide `Activity` (pulse-line) glyph on a rounded primary
// swatch, so the mark repaints with the gender theme like everything else.
export function PulseMark({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-contrast ${className ?? "h-8 w-8"}`}
    >
      <Activity className="h-[55%] w-[55%]" strokeWidth={2.25} />
    </span>
  );
}
