"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Search, UserRoundPlus } from "lucide-react";
import { usePatients } from "@/lib/hooks/use-patients";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCsvExport } from "@/lib/hooks/use-csv-export";
import { PatientCard } from "@/components/patients/PatientCard";
import { Spinner } from "@/components/ui/Spinner";

const PAGE_SIZE = 20;

// Auth-gating + chrome (sidebar/mobile top bar, Phase 10) now live in
// app/(dashboard)/layout.tsx.
export default function PatientsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const { data, isLoading, isError, error } = usePatients(search, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  // Exports the caller's own appointment log (every visit, across every
  // one of their patients) as CSV — matches the same name/OPD-no search
  // above, so exporting while filtered exports just that filtered set.
  const csvExport = useCsvExport("/api/patients/export");

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="mt-1 text-sm text-muted">Your own list — separate from every other resident&rsquo;s.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => csvExport.triggerExport(search)}
            disabled={csvExport.exporting}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {csvExport.exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link
            href="/patients/new"
            className="flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-contrast"
          >
            <UserRoundPlus className="h-4 w-4" />
            Add today&rsquo;s patient
          </Link>
        </div>
      </div>

      <label className="relative block max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search by name or OPD no."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {csvExport.error && <p className="text-sm text-danger">{csvExport.error}</p>}

      {isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner label="Loading patients…" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-danger">
          Couldn&rsquo;t load patients: {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}

      {data && data.patients.length === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            {search
              ? `No patients match "${search}".`
              : "No patients yet. Scan a prescription or add one manually to get started."}
          </p>
        </div>
      )}

      {data && data.patients.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.patients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
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
    </main>
  );
}
