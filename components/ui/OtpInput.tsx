"use client";

import { useRef } from "react";

// Six individually-boxed digit inputs behaving like one field — paste a full
// code into any box and it fans out across the rest, typing auto-advances,
// backspace on an empty box steps back. Used by the signup OTP step
// (app/(auth)/signup/page.tsx).
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
}: Readonly<{ value: string; onChange: (value: string) => void; length?: number; disabled?: boolean }>) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, digit: string) {
    const next = value.split("");
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setDigit(index, "");
      return;
    }
    if (digits.length > 1) {
      // Pasted (or autofilled) a full code into one box — fan it out.
      onChange((value.slice(0, index) + digits).slice(0, length));
      const nextIndex = Math.min(index + digits.length, length - 1);
      inputsRef.current[nextIndex]?.focus();
      return;
    }
    setDigit(index, digits);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={length} // allows paste-into-any-box to work, trimmed in handleChange
          autoComplete={i === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-10 rounded-md border border-border bg-surface text-center text-lg font-medium text-text outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}
