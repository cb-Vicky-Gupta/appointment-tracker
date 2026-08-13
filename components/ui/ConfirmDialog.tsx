"use client";

import { useEffect, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";

// Shared confirmation modal for consequential admin actions (suspend,
// reactivate, force-logout, role change, ...) — a real dialog the user has
// to explicitly dismiss or confirm, not a bare `window.confirm()` (which is
// easy to blow through on muscle-memory and gives no room to explain the
// consequence). Delete already goes further than this — typing the
// account's exact email — so it doesn't route through here.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  confirming = false,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + red icon badge, for actions with a real downside
   *  (suspend, remove admin access) vs. a neutral one (reactivate). */
  danger?: boolean;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-danger/10 text-danger" : "bg-accent-soft text-primary"
            }`}
          >
            <TriangleAlert className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-medium text-text">{title}</h2>
            <div className="mt-1 text-sm text-muted">{description}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
              danger ? "bg-danger text-white" : "bg-primary text-primary-contrast"
            }`}
          >
            {confirming ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
