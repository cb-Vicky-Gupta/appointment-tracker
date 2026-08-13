// Shared "parse a fetch Response as JSON, throwing the API's own `error`
// message on a non-2xx" helper — was copy-pasted per-hook (use-patients.ts,
// use-patient-mutations.ts, ...); every admin hook (Plan Phase C) needed the
// exact same thing, so it's consolidated here instead of a fourth copy.
export async function fetchJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}
