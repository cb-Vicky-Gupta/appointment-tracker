"use client";

import { useState, type FormEvent } from "react";
import { Check, GraduationCap, UserCircle } from "lucide-react";
import { useAuth, type Gender } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useUpdateProfile } from "@/lib/hooks/use-update-profile";

// "Other" is deliberately not offered here — same as signup (Reference F):
// it's only ever a pre-signup default, never a choice a user makes.
const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

const STUDENT_TYPE_OPTIONS: Array<{ value: "UG" | "PG"; label: string }> = [
  { value: "UG", label: "UG (undergraduate)" },
  { value: "PG", label: "PG (postgraduate/resident)" },
];

// UG courses (MBBS/BDS) run longer than a PG residency, so the two get
// different year lists rather than one one-size-fits-all dropdown.
const YEAR_OPTIONS: Record<"UG" | "PG", readonly string[]> = {
  UG: ["1st Year", "2nd Year", "3rd Year", "4th Year", "Final Year", "Internship"],
  PG: ["1st Year", "2nd Year", "3rd Year"],
};

interface ProfessionalDraft {
  specialization: string;
  institute: string;
  phone: string;
}

// Auth-gating + chrome (sidebar/mobile top bar, Phase 10) now live in
// app/(dashboard)/layout.tsx, so `user` here is never null.
export default function ProfilePage() {
  const { user } = useAuth();
  const { themeMode } = useTheme();
  const updateProfile = useUpdateProfile();

  // `nameDraft` is null until the user actually types — until then, `name`
  // is derived straight from `user.name`, so there's nothing to synchronize
  // via an effect (matches the "derived value, not effect+setState" approach
  // used throughout, e.g. ThemeProvider). It resets to null on a successful
  // save so the input falls back to reflecting the freshly-saved `user.name`.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const name = nameDraft ?? user?.name ?? "";

  // Same derived-draft pattern, bundled for the three free-text professional
  // fields so they share one "Save" action instead of one button each.
  const [proDraft, setProDraft] = useState<ProfessionalDraft | null>(null);
  const [proSaved, setProSaved] = useState(false);
  const professional: ProfessionalDraft = proDraft ?? {
    specialization: user?.specialization ?? "",
    institute: user?.institute ?? "",
    phone: user?.phone ?? "",
  };

  if (!user) return null;

  async function handleNameSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === user!.name) return;
    setNameSaved(false);
    await updateProfile.mutateAsync({ name: trimmed });
    setNameDraft(null);
    setNameSaved(true);
  }

  function handleGenderChange(gender: Gender) {
    if (gender === user!.gender) return;
    updateProfile.mutate({ gender });
  }

  function handleThemeModeChange(mode: "light" | "dark") {
    if (mode === themeMode && user!.themeMode === mode) return;
    updateProfile.mutate({ themeMode: mode });
  }

  function handleStudentTypeChange(studentType: "UG" | "PG") {
    if (studentType === user!.studentType) return;
    updateProfile.mutate({ studentType });
    // Note: a previously-saved `year` that doesn't belong to the new list
    // (e.g. "Final Year" while UG, then switching to PG) just won't show as
    // selected below — updateMeSchema treats "" as "no change" like every
    // other optional field here, so there's no clean way to explicitly
    // clear it; picking a new year below overwrites it either way.
  }

  function handleYearChange(year: string) {
    if (year === user!.year) return;
    updateProfile.mutate({ year });
  }

  const professionalUnchanged =
    professional.specialization === (user.specialization ?? "") &&
    professional.institute === (user.institute ?? "") &&
    professional.phone === (user.phone ?? "");

  async function handleProfessionalSubmit(e: FormEvent) {
    e.preventDefault();
    if (professionalUnchanged) return;
    setProSaved(false);
    await updateProfile.mutateAsync({
      specialization: professional.specialization.trim(),
      institute: professional.institute.trim(),
      phone: professional.phone.trim(),
    });
    setProDraft(null);
    setProSaved(true);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <UserCircle className="h-6 w-6 text-primary" />
          Your profile
        </h1>
        <p className="mt-1 text-sm text-muted">
          Gender and theme drive how the whole app looks — changes apply everywhere and
          survive a reload.
        </p>
      </div>

      <form
        onSubmit={handleNameSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <h2 className="text-sm font-medium text-muted">Name</h2>
        <div className="flex max-w-sm items-center gap-2">
          <input
            value={name}
            onChange={(e) => {
              setNameDraft(e.target.value);
              setNameSaved(false);
            }}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={updateProfile.isPending || !name.trim() || name.trim() === user.name}
            className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {nameSaved && (
          <p className="flex items-center gap-1 text-xs text-primary">
            <Check className="h-3.5 w-3.5" />
            Saved
          </p>
        )}
      </form>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <h2 className="text-sm font-medium text-muted">Gender</h2>
          <p className="mt-0.5 text-xs text-muted">
            Sets which color palette the app uses for you.
          </p>
        </div>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleGenderChange(value)}
              disabled={updateProfile.isPending}
              aria-pressed={user.gender === value}
              className={`cursor-pointer rounded-md border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                user.gender === value
                  ? "border-primary bg-accent-soft font-medium text-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <h2 className="text-sm font-medium text-muted">Theme</h2>
          <p className="mt-0.5 text-xs text-muted">
            Persisted to your account — the sidebar toggle is a quick, this-device-only flip;
            this one follows you everywhere you log in.
          </p>
        </div>
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleThemeModeChange(mode)}
              disabled={updateProfile.isPending}
              aria-pressed={user.themeMode === mode}
              className={`cursor-pointer rounded-md border px-4 py-2 text-sm capitalize disabled:cursor-not-allowed disabled:opacity-50 ${
                user.themeMode === mode
                  ? "border-primary bg-accent-soft font-medium text-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <GraduationCap className="h-4 w-4" />
            Student type &amp; year
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Whether you&rsquo;re an undergrad or postgrad, and which year — the year options
            below depend on this.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STUDENT_TYPE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleStudentTypeChange(value)}
              disabled={updateProfile.isPending}
              aria-pressed={user.studentType === value}
              className={`cursor-pointer rounded-md border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                user.studentType === value
                  ? "border-primary bg-accent-soft font-medium text-primary"
                  : "border-border hover:border-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {user.studentType === "UG" || user.studentType === "PG" ? (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {YEAR_OPTIONS[user.studentType].map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleYearChange(year)}
                disabled={updateProfile.isPending}
                aria-pressed={user.year === year}
                className={`cursor-pointer rounded-md border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                  user.year === year
                    ? "border-primary bg-accent-soft font-medium text-primary"
                    : "border-border hover:border-primary"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted">
            Pick UG or PG above to choose your year.
          </p>
        )}
      </div>

      <form
        onSubmit={handleProfessionalSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <div>
          <h2 className="text-sm font-medium text-muted">Professional details</h2>
          <p className="mt-0.5 text-xs text-muted">
            Shown nowhere else in the app yet, but kept with your account for when it is.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Specialization / Department</span>
            <input
              value={professional.specialization}
              onChange={(e) => {
                setProDraft({ ...professional, specialization: e.target.value });
                setProSaved(false);
              }}
              placeholder="e.g. General Medicine, Dentistry"
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">Institute / Hospital</span>
            <input
              value={professional.institute}
              onChange={(e) => {
                setProDraft({ ...professional, institute: e.target.value });
                setProSaved(false);
              }}
              placeholder="e.g. Buddha Institute of Dental Sciences"
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2 sm:max-w-xs">
            <span className="text-muted">Phone</span>
            <input
              type="tel"
              value={professional.phone}
              onChange={(e) => {
                setProDraft({ ...professional, phone: e.target.value });
                setProSaved(false);
              }}
              placeholder="10-digit contact number"
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateProfile.isPending || professionalUnchanged}
            className="w-fit cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
          {proSaved && (
            <p className="flex items-center gap-1 text-xs text-primary">
              <Check className="h-3.5 w-3.5" />
              Saved
            </p>
          )}
        </div>
      </form>

      {updateProfile.isError && (
        <p className="text-sm text-danger">
          {updateProfile.error instanceof Error ? updateProfile.error.message : "Couldn't save that change."}
        </p>
      )}
    </main>
  );
}
