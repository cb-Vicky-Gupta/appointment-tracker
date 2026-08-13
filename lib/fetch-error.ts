// Shared "pull `error` out of a JSON error response, falling back to a
// default message" helper — used by every unauthenticated auth flow
// (login/signup/forgot-password) that isn't going through `authFetch`.
export async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}
