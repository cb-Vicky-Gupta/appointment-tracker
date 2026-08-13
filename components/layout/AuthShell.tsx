import type { ReactNode } from "react";
import { PulseMark } from "@/components/icons/PulseMark";

// Asymmetric two-pane layout for the auth screens — deliberately not the
// centered-card default (PRD Reference G). Form on the left, a patterned
// panel with real micro-copy on the right; the right pane drops out below
// `md` rather than trying to stack decoratively on mobile.
export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex flex-1">
      <div className="flex w-full flex-1 flex-col md:w-[55%]">
        <div className="flex items-center gap-2 px-6 pt-8 md:px-12">
          <PulseMark className="h-8 w-8" />
          <span className="font-display text-lg font-medium">Ilazdoot</span>
        </div>
        {children}
      </div>

      <div
        className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 text-primary-contrast md:flex"
        style={{
          backgroundColor: "var(--primary)",
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.14) 0, transparent 45%), radial-gradient(circle at 85% 75%, rgba(255,255,255,0.10) 0, transparent 40%)",
        }}
      >
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.15]" aria-hidden="true" />
        <div className="relative z-10 flex flex-1 flex-col items-start justify-center gap-6">
          <p className="font-display max-w-sm text-3xl leading-tight">
            One line per visit. Nothing overwritten, nothing lost.
          </p>
          <p className="max-w-sm text-sm opacity-80">
            Scan an OPD slip, and it comes back the next time the same patient does — your
            own list, separate from every other resident&rsquo;s.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-6 text-sm">
          <Stat value="Private" label="per PG user" />
          <Stat value="Editable" label="OCR is a suggestion" />
          <Stat value="Append-only" label="history never overwritten" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: Readonly<{ value: string; label: string }>) {
  return (
    <div className="border-l border-white/25 pl-3">
      <div className="font-display text-base">{value}</div>
      <div className="opacity-70">{label}</div>
    </div>
  );
}
