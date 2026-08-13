"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { parseErrorMessage } from "@/lib/fetch-error";
import { AuthShell } from "@/components/layout/AuthShell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { OtpInput } from "@/components/ui/OtpInput";
import { ButtonSpinner } from "@/components/ui/ButtonSpinner";

type Step = "email" | "otp" | "password";
const RESEND_COOLDOWN_S = 30;

// Mirrors the signup OTP flow (app/(auth)/signup/page.tsx) exactly, just
// against an existing account: email -> a 6-digit OTP is emailed -> verify
// it -> choose a new password. The email step's response is intentionally
// identical whether or not the address is registered (see
// app/api/auth/forgot-password/route.ts), so this UI always advances to the
// OTP step regardless — it never reveals which emails have accounts.
export default function ForgotPasswordPage() {
  const { completePasswordReset } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
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
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res, "Couldn't send the code"));
  }

  async function handleEmailSubmit(e: FormEvent) {
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
      const res = await fetch("/api/auth/reset-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) throw new Error(await parseErrorMessage(res, "Incorrect code"));
      const data = await res.json();
      setResetToken(data.resetToken);
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
    if (!resetToken) {
      setError("Your verification expired — please start again");
      setStep("email");
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordReset(resetToken, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset your password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12 md:px-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-muted">
              {step === "email" && "We'll email you a code to verify it's you."}
              {step === "otp" && "Enter the code we sent."}
              {step === "password" && "Choose a new password."}
            </p>
          </div>
          <ThemeToggle />
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="h-3.5 w-3.5" />
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {submitting ? "Sending code…" : "Send verification code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
            <div className="text-sm">
              <p className="flex items-center gap-1.5 text-muted">
                <ShieldCheck className="h-3.5 w-3.5" />
                If <span className="font-medium text-text">{email}</span> has an account, we sent
                it a 6-digit code.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
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
              Code verified — choose a new password.
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <KeyRound className="h-3.5 w-3.5" />
                New password
              </span>
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
              {submitting ? "Saving…" : "Reset password & log in"}
            </button>
          </form>
        )}

        <p className="text-sm text-muted">
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
