// Phase 7 — Prescription OCR → autofill (PRD Reference E).
//
// Everything here runs entirely in the browser. The prescription image never
// leaves the device: `scanPrescription` hands the in-memory File/Blob to
// Tesseract.js, gets raw text back, and the image reference is dropped by the
// caller once this resolves — nothing binary is ever sent to `/api/*`.
//
// Prescriptions are usually handwritten, so Tesseract (built for printed
// text) will often miss fields entirely. This is convenience autofill, not a
// guarantee — every extracted field just pre-fills a normal editable form.

export interface ExtractedFields {
  name?: string;
  opdNo?: string;
  phone?: string;
  age?: number;
  address?: string;
  /** ISO `yyyy-mm-dd`, ready to drop into an `<input type="date">`. */
  appointmentDate?: string;
}

// OPD slips print "OPD No." (sometimes "OPD No" with no dot, sometimes just
// "OPD") before the separator and number — the label text itself, not only a
// single punctuation character, sits between "OPD" and the digits.
const OPD_NO_RE = /OPD\s*(?:No\.?)?\s*[:#-]?\s*(\d+)/i;
const PHONE_RE = /\b(\d{10})\b/;
const AGE_RE = /\b(\d{1,3})\s*(?:yrs?|years?|y)\b/i;
const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;

// Name/Address both capture "everything after the label, until the next
// label" — the character classes below deliberately include `\s` (so a
// wrapped/joined line doesn't cut the match early) and, for address,
// digits/commas (house/PIN numbers, "City, State"). LABEL_STOP_RE then
// trims that capture back down to just before whichever next label OCR
// ran it into, since without a real line break there's nothing else to
// stop on.
const NAME_RE = /Name\s*[:#-]?\s*([A-Za-z][A-Za-z.\s]{1,60})/i;
const ADDRESS_RE = /Address\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9,.\s-]{1,150})/i;
const LABEL_STOP_RE = /\b(Name|Age|Sex|Address|Phone|Mobile|E\s*[-]?\s*Mail|Date|OPD)\b/i;

/** Runs a "Label: rest-of-line" regex and trims the capture back to just
 *  before the next field label (see LABEL_STOP_RE) and any trailing
 *  punctuation/whitespace OCR left behind. */
function captureLabeledField(rawText: string, re: RegExp): string | undefined {
  const match = rawText.match(re);
  if (!match) return undefined;
  const stopAt = match[1].search(LABEL_STOP_RE);
  const raw = stopAt === -1 ? match[1] : match[1].slice(0, stopAt);
  const value = raw.replace(/[.\s]+$/, "").trim();
  return value || undefined;
}

/** 2-digit years: PRD-era prescriptions are all 20xx, not 19xx. */
function normalizeYear(year: number): number {
  if (year >= 100) return year;
  return 2000 + year;
}

/** Indian OPD slips are day/month/year; try that first, then swap if the
 *  first number can't be a day (i.e. it's actually month/day/year). */
function parseDateParts(a: number, b: number, yRaw: number): string | undefined {
  const year = normalizeYear(yRaw);
  const candidates: Array<[number, number]> = [
    [a, b], // [day, month]
    [b, a], // [month, day] swapped
  ];
  for (const [day, month] of candidates) {
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const date = new Date(Date.UTC(year, month - 1, day));
    // Reject overflow (e.g. day 31 in a 30-day month rolling into next month).
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return date.toISOString().slice(0, 10);
    }
  }
  return undefined;
}

/** Pattern-match likely fields out of raw OCR text (PRD Reference E, item 3).
 *  Never throws — a field that doesn't match is simply omitted so the form
 *  falls back to blank/manual entry. */
export function extractFields(rawText: string): ExtractedFields {
  const fields: ExtractedFields = {};

  const name = captureLabeledField(rawText, NAME_RE);
  if (name) fields.name = name;

  const address = captureLabeledField(rawText, ADDRESS_RE);
  if (address) fields.address = address;

  const opdMatch = rawText.match(OPD_NO_RE);
  if (opdMatch) fields.opdNo = opdMatch[1];

  const phoneMatch = rawText.match(PHONE_RE);
  if (phoneMatch) fields.phone = phoneMatch[1];

  const ageMatch = rawText.match(AGE_RE);
  if (ageMatch) {
    const age = Number(ageMatch[1]);
    if (age >= 0 && age <= 150) fields.age = age;
  }

  const dateMatch = rawText.match(DATE_RE);
  if (dateMatch) {
    const parsed = parseDateParts(Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]));
    if (parsed) fields.appointmentDate = parsed;
  }

  return fields;
}

export interface ScanResult {
  text: string;
  fields: ExtractedFields;
  /** Tesseract's own 0-100 confidence for the recognized text. Low values
   *  (see PrescriptionScanner's LOW_CONFIDENCE_THRESHOLD) usually mean the
   *  photo itself was the problem — too much clutter/angle/glare around the
   *  label — rather than anything extractFields' regexes can fix; the UI
   *  surfaces this as a stronger "double-check everything" prompt. */
  confidence: number;
}

/** Runs OCR on an in-memory image (client-side only, in a Web Worker via
 *  Tesseract.js) and regex-extracts likely fields from the result. The
 *  worker is created and torn down per scan — this is a "scan one
 *  prescription occasionally" flow, not a hot loop, so there's no shared
 *  worker/scheduler to manage. */
export async function scanPrescription(image: Blob): Promise<ScanResult> {
  if (typeof window === "undefined") {
    throw new Error("scanPrescription can only run in the browser");
  }
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(image);
    const text = data.text ?? "";
    return { text, fields: extractFields(text), confidence: data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}
