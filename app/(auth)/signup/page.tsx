"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, type Gender } from "@/lib/auth-context";
import { AuthShell } from "@/components/layout/AuthShell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Gender is required here (not an afterthought on a later "profile" step)
// because it drives the theme system from the very first screen — Phase 4 /
// Reference F.
export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("OTHER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({ name, email, password, gender });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12 md:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Set up your log</h1>
            <p className="mt-1 text-sm text-muted">
              Every resident gets their own private patient list.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
          <fieldset className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Gender</span>
            <span className="text-xs text-muted">Sets your color theme — you can flip light/dark independently.</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["FEMALE", "MALE", "OTHER"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  aria-pressed={gender === g}
                  className={`cursor-pointer rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                    gender === g
                      ? "border-primary bg-accent-soft text-text"
                      : "border-border bg-surface text-muted hover:text-text"
                  }`}
                >
                  {g.toLowerCase()}
                </button>
              ))}
            </div>
          </fieldset>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 cursor-pointer rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
