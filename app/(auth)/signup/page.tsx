"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Mail, ShieldCheck, KeyRound } from "lucide-react";
import { useAuth, type Gender } from "@/lib/auth-context";
import { parseErrorMessage } from "@/lib/fetch-error";
import { AuthShell } from "@/components/layout/AuthShell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OtpInput } from "@/components/ui/OtpInput";
import { ButtonSpinner } from "@/components/ui/ButtonSpinner";

type SignupGender = Extract<Gender, "MALE" | "FEMALE">;
type Step = "details" | "otp" | "password";

const STEPS: Array<{ key: Step; label: string; icon: typeof Mail }> = [
  { key: "details", label: "Details", icon: Mail },
  { key: "otp", label: "Verify", icon: ShieldCheck },
  { key: "password", label: "Password", icon: KeyRound },
];
const RESEND_COOLDOWN_S = 30;

// Signup is a 3-step, email-verified flow (PRD deviation — see PRD.md): enter
// details -> a 6-digit OTP is emailed -> verify it -> choose a password. No
// account exists until step 3 succeeds. Gender is required up front (drives
// the theme system, Reference F) but only offers Male/Female now — "Other"
// remains the neutral pre-login/profile-level default, just not a signup choice.
export default function SignupPage() {
  const { completeSignup } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<SignupGender>("FEMALE");
  const [otp, setOtp] = useState("");
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(cooldownRef.current ?? undefined);
  }, [resendCooldown]);

  async function requestOtp() {
    const res = await fetch("/api/auth/signup/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, gender }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Couldn't send the code"));
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestOtp();
      setOtp("");
      setResendCooldown(RESEND_COOLDOWN_S);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setSubmitting(true);
    try {
      await requestOtp();
      setResendCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the code");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Incorrect code"));
      const data = await res.json();
      setSignupToken(data.signupToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (!signupToken) {
      setError("Your verification expired — please start again");
      setStep("details");
      return;
    }
    setSubmitting(true);
    try {
      await completeSignup(signupToken, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account");
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

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

        <StepIndicator currentIndex={stepIndex} />

        {step === "details" && (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
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
            <fieldset className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Gender</span>
              <span className="text-xs text-muted">Sets your color theme — you can flip light/dark independently.</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(["FEMALE", "MALE"] as const).map((g) => (
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
              className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <ButtonSpinner />}
              {submitting ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
            <div className="text-sm">
              <p className="text-muted">
                We sent a 6-digit code to <span className="font-medium text-text">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setError(null);
                }}
                className="mt-0.5 cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                Wrong email? Go back
              </button>
            </div>

            <OtpInput value={otp} onChange={setOtp} disabled={submitting} />

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <ButtonSpinner />}
              {submitting ? "Verifying…" : "Verify code"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={submitting || resendCooldown > 0}
              className="cursor-pointer text-sm text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <p className="flex items-center gap-1.5 text-sm text-primary">
              <Check className="h-4 w-4" />
              Email verified — choose a password to finish.
            </p>
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
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Confirm password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-contrast transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <ButtonSpinner />}
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

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

function StepIndicator({ currentIndex }: Readonly<{ currentIndex: number }>) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map(({ key, label, icon: Icon }, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={key} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
                done
                  ? "border-primary bg-primary text-primary-contrast"
                  : active
                    ? "border-primary text-primary"
                    : "border-border text-muted"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </span>
            <span className={`text-xs ${active ? "font-medium text-text" : "text-muted"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
