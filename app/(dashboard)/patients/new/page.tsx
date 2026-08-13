"use client";

import { Suspense, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, UserRoundPlus, X } from "lucide-react";
import { usePatients, type PatientListItem } from "@/lib/hooks/use-patients";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useCreatePatient, useAddAppointment } from "@/lib/hooks/use-patient-mutations";
import { PrescriptionScanner } from "@/components/patients/PrescriptionScanner";
import { Spinner } from "@/components/ui/Spinner";
import type { ScanResult } from "@/lib/ocr";

type MatchTarget = Pick<PatientListItem, "id" | "name" | "opdNo">;

const INPUT_CLASS = "rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary";

// "Today" per the resident's own clock, as the "YYYY-MM-DD" an
// <input type="date"> expects — plain toISOString() would hand back
// yesterday for anyone west of UTC.
function todayLocal() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// Both date fields are date-only — a visit is "the 13th", not "the 13th at
// 00:00 +05:30" — so they're pinned to UTC midnight rather than local
// midnight. Everything that reads them back (the CSV export, the history
// card) formats in UTC to match, which is what keeps the day from drifting
// across timezones in either direction.
function dateToIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export default function NewAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <NewAppointmentPageInner />
    </Suspense>
  );
}

// Auth-gating + chrome (sidebar/mobile top bar, Phase 10) now live in
// app/(dashboard)/layout.tsx.
function NewAppointmentPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Arriving from a patient's own detail page ("Add visit") already knows who
  // this is — skip the match-suggestion step entirely (PRD Reference J: the
  // append route is only ever hit on an explicit, already-confirmed choice).
  const presetId = searchParams.get("patientId");
  const presetName = searchParams.get("name");
  const presetOpdNo = searchParams.get("opdNo");
  const initialTarget: MatchTarget | null =
    presetId && presetName && presetOpdNo ? { id: presetId, name: presetName, opdNo: presetOpdNo } : null;

  const [target, setTarget] = useState<MatchTarget | null>(initialTarget);

  const [name, setName] = useState("");
  const [opdNo, setOpdNo] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  // Defaults to today — the overwhelmingly common case is "the patient I'm
  // seeing right now", and a prefilled value is what makes it safe to require
  // the field below instead of silently falling back to now() on the server.
  const [appointmentDate, setAppointmentDate] = useState(todayLocal);
  // No default: most visits don't end with a follow-up booked, and
  // pre-filling a date here would silently invent appointments nobody agreed
  // to.
  const [nextAppointmentDate, setNextAppointmentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [ocrRawText, setOcrRawText] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const createPatient = useCreatePatient();
  const addAppointment = useAddAppointment(target?.id ?? "");
  const isSaving = createPatient.isPending || addAppointment.isPending;

  // While no existing patient is picked, search-as-you-type on whatever
  // identity fields are filled in — same endpoint the patient list itself
  // uses (Reference J: no separate "match" endpoint).
  const matchQuery = useDebouncedValue(target ? "" : (opdNo || name).trim(), 300);
  const { data: matches } = usePatients(matchQuery, 1);
  const suggestions = target ? [] : (matches?.patients ?? []).slice(0, 5);

  function onScanned(result: ScanResult) {
    const { fields, text } = result;
    if (fields.name) setName(fields.name);
    if (fields.opdNo) setOpdNo(fields.opdNo);
    if (fields.phone) setPhone(fields.phone);
    if (fields.address) setAddress(fields.address);
    if (fields.age !== undefined) setAge(String(fields.age));
    if (fields.appointmentDate) setAppointmentDate(fields.appointmentDate);
    setOcrRawText(text);
  }

  function pickMatch(patient: PatientListItem) {
    setTarget({ id: patient.id, name: patient.name, opdNo: patient.opdNo });
    setFormError(null);
  }

  function clearTarget() {
    setTarget(null);
    // Coming from a preset link with nowhere else to search from — send
    // straight back rather than leaving a dead-end "new patient" form for a
    // patient the resident already had open.
    if (initialTarget) router.push("/patients");
  }

  const sharedVisitFields = useMemo(
    () => ({
      appointmentDate: appointmentDate ? dateToIso(appointmentDate) : undefined,
      nextAppointmentDate: nextAppointmentDate ? dateToIso(nextAppointmentDate) : undefined,
      notes: notes.trim() || undefined,
      ocrRawText,
    }),
    [appointmentDate, nextAppointmentDate, notes, ocrRawText]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    try {
      if (!appointmentDate) {
        setFormError("Visit date is required.");
        return;
      }

      // Both are "YYYY-MM-DD" here, so a plain string compare is a correct
      // date compare — no parsing needed. The <input min> above already
      // blocks this in the picker; this catches typed-in values.
      if (nextAppointmentDate && nextAppointmentDate < appointmentDate) {
        setFormError("The appointment date can't be before the visit date.");
        return;
      }

      if (target) {
        const { appointment } = await addAppointment.mutateAsync(sharedVisitFields);
        router.push(`/patients/${appointment.patientId}`);
        return;
      }

      if (!name.trim() || !opdNo.trim()) {
        setFormError("Name and OPD No. are required.");
        return;
      }

      const { patient } = await createPatient.mutateAsync({
        name: name.trim(),
        opdNo: opdNo.trim(),
        age: age ? Number(age) : undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        ...sharedVisitFields,
      });
      router.push(`/patients/${patient.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <UserRoundPlus className="h-6 w-6 text-primary" />
          {target ? `Add a visit for ${target.name}` : "Add today's patient"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {target
            ? `OPD ${target.opdNo} — this adds a new visit; earlier ones stay untouched.`
            : "Scan a prescription or type the details in — every field below stays editable."}
        </p>
      </div>

      {!target && <PrescriptionScanner onScanned={onScanned} />}

      {target && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-accent-soft p-3 text-sm">
          <span>
            Adding to <span className="font-medium">{target.name}</span> (OPD {target.opdNo})
          </span>
          <button
            type="button"
            onClick={clearTarget}
            className="flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
            Not them
          </button>
        </div>
      )}

      {!target && suggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium">Found a possible match — same patient?</p>
          <p className="mt-1 text-xs text-muted">
            Picking one adds this visit to their existing history instead of creating a
            duplicate patient.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {suggestions.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => pickMatch(patient)}
                className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary"
              >
                <span>
                  {patient.name} <span className="text-muted">· OPD {patient.opdNo}</span>
                </span>
                <span className="text-xs text-primary">Add visit to this patient →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        {!target && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Patient's full name"
              />
            </Field>
            <Field label="OPD No." required>
              <input
                value={opdNo}
                onChange={(e) => setOpdNo(e.target.value)}
                className={INPUT_CLASS}
                placeholder="4021"
              />
            </Field>
            <Field label="Age">
              <input
                type="number"
                min={0}
                max={150}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
                placeholder="10-digit"
              />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
            </Field>
            <Field label="Address">
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLASS} />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visit date" required>
            <input
              type="date"
              required
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Appointment date">
            <input
              type="date"
              min={appointmentDate || undefined}
              value={nextAppointmentDate}
              onChange={(e) => setNextAppointmentDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={`${INPUT_CLASS} resize-none`}
            placeholder="Diagnosis, prescription, follow-up plan…"
          />
        </Field>

        {ocrRawText && (
          <p className="text-xs text-muted">
            Scanned text was used to pre-fill the fields above — nothing else is kept once you
            save.
          </p>
        )}

        {formError && <p className="text-sm text-danger">{formError}</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-2 flex w-fit cursor-pointer items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-contrast disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : target ? "Save visit" : "Save patient & visit"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: Readonly<{ label: string; required?: boolean; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}
