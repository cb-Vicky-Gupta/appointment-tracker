"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, UserRoundPlus } from "lucide-react";
import { usePatientDetail } from "@/lib/hooks/use-patient-detail";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { AppointmentEntry } from "@/components/patients/AppointmentEntry";
import { Spinner } from "@/components/ui/Spinner";

// Auth-gating + chrome (sidebar/mobile top bar, Phase 10) now live in
// app/(dashboard)/layout.tsx.
export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const { data, isLoading, isError, error } = usePatientDetail(params.id, search, page);

  const meta = data?.appointmentsMeta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <button
        type="button"
        onClick={() => router.push("/patients")}
        className="flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to patients
      </button>

      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner label="Loading patient…" />
        </div>
      )}

      {isError && error instanceof Error && error.message === "NOT_FOUND" && (
        <p className="text-sm text-danger">
          This patient doesn&rsquo;t exist, or isn&rsquo;t in your list.
        </p>
      )}

      {isError && error instanceof Error && error.message !== "NOT_FOUND" && (
        <p className="text-sm text-danger">Couldn&rsquo;t load this patient: {error.message}</p>
      )}

      {data && (
        <>
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold">{data.patient.name}</h1>
              <Link
                href={`/patients/new?patientId=${data.patient.id}&name=${encodeURIComponent(
                  data.patient.name
                )}&opdNo=${encodeURIComponent(data.patient.opdNo)}`}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-contrast"
              >
                <UserRoundPlus className="h-4 w-4" />
                Add visit
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Field label="OPD No." value={data.patient.opdNo} />
              <Field label="Age" value={data.patient.age !== null ? String(data.patient.age) : "—"} />
              <Field label="Phone" value={data.patient.phone ?? "—"} />
              <Field label="Email" value={data.patient.email ?? "—"} />
              <Field label="Address" value={data.patient.address ?? "—"} className="col-span-2 sm:col-span-4" />
            </dl>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Appointment history
                <span className="ml-2 text-sm font-normal text-muted">
                  {data.appointmentsMeta.total} visit{data.appointmentsMeta.total === 1 ? "" : "s"}
                </span>
              </h2>

              <label className="relative block w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  placeholder="Search visit notes…"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-md border border-border bg-surface py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>

            {data.appointments.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                {search ? `No visits match "${search}".` : "No visits recorded yet."}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {data.appointments.map((appointment, i) => (
                  <AppointmentEntry
                    key={appointment.id}
                    appointment={appointment}
                    isLatest={page === 1 && i === 0 && !search}
                  />
                ))}
              </div>
            )}

            {data.appointmentsMeta.total > data.appointmentsMeta.pageSize && (
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="cursor-pointer rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="cursor-pointer rounded-md border border-border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  className = "",
}: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
