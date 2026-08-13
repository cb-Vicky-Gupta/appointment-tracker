"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

// Shared "fetch a CSV export endpoint with the Authorization header and
// hand the browser a temporary object URL to save" — first built for the
// admin user export (Plan Phase D), reused for the resident-facing
// appointment export since it's the exact same download mechanics either
// way; only the endpoint differs.
export function useCsvExport(endpoint: string) {
  const { authFetch } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function triggerExport(search?: string) {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await authFetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "export.csv";
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return { exporting, error, triggerExport };
}
