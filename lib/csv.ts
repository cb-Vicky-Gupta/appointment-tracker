// Minimal CSV builder — no library needed for this: quote every field and
// escape embedded quotes (RFC 4180), which is the one rule that actually
// matters for names/institutes/emails that might contain a comma.
export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const escapeField = (value: string | number | null): string => {
    const s = value === null ? "" : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.map(escapeField).join(","),
    ...rows.map((row) => row.map(escapeField).join(",")),
  ];
  return lines.join("\r\n");
}
