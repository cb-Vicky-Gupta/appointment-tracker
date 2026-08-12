"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRequireAuth } from "@/lib/use-require-auth";
import { usePatients } from "@/lib/hooks/use-patients";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { AppHeader } from "@/components/layout/AppHeader";
import { PatientCard } from "@/components/patients/PatientCard";
import { Spinner } from "@/components/ui/Spinner";

const PAGE_SIZE = 20;

export default function PatientsPage() {
  const { ready } = useRequireAuth();
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const { data, isLoading, isError, error } = usePatients(search, page);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="mt-1 text-sm text-muted">Your own list — separate from every other resident&rsquo;s.</p>
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
                : "No patients yet. Scanning a prescription (coming in the next phase) will add your first one."}
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
    </div>
  );
}
