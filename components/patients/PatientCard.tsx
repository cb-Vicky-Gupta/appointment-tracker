import Link from "next/link";
import type { PatientListItem } from "@/lib/hooks/use-patients";

function formatDate(iso: string | null) {
  if (!iso) return "No visits yet";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PatientCard({ patient }: Readonly<{ patient: PatientListItem }>) {
  return (
    <Link
      href={`/patients/${patient.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{patient.name}</p>
        <p className="mt-0.5 text-sm text-muted">
          OPD {patient.opdNo}
          {patient.age !== null ? ` · ${patient.age}y` : ""}
          {patient.phone ? ` · ${patient.phone}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end text-sm">
        <span className="text-text">{formatDate(patient.lastVisitAt)}</span>
        <span className="text-muted">
          {patient.visitCount} visit{patient.visitCount === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
