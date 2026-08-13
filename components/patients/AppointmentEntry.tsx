"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AppointmentRecord } from "@/lib/hooks/use-patient-detail";

// Rendered in UTC to match how these date-only values are stored (see
// dateToIso in the new-visit form) — without it, a visit saved as "13 Aug"
// displays as the 12th for any viewer west of UTC.
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AppointmentEntry({
  appointment,
  isLatest,
}: Readonly<{ appointment: AppointmentRecord; isLatest: boolean }>) {
  const [showRawText, setShowRawText] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{formatDateTime(appointment.appointmentDate)}</span>
        {isLatest && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-primary">
            Most recent
          </span>
        )}
      </div>

      {appointment.nextAppointmentDate && (
        <p className="mt-1 text-sm text-muted">
          Next appointment:{" "}
          <span className="text-text">{formatDateTime(appointment.nextAppointmentDate)}</span>
        </p>
      )}

      {appointment.notes ? (
        <p className="mt-2 text-sm text-text">{appointment.notes}</p>
      ) : (
        <p className="mt-2 text-sm text-muted italic">No notes recorded for this visit.</p>
      )}

      {appointment.ocrRawText && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowRawText((v) => !v)}
            className="flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-text"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRawText ? "rotate-180" : ""}`} />
            {showRawText ? "Hide" : "Show"} scanned text
          </button>
          {showRawText && (
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-bg p-3 text-xs text-muted">
              {appointment.ocrRawText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
