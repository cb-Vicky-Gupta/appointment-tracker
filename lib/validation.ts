import { z } from "zod";

// Shared Zod schemas for API request bodies — these are the single source of
// truth for both the API routes and (later) any mobile client hitting the
// same endpoints.

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  gender: genderSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

// --- Patients & appointments (Phase 5) -------------------------------------
// "" is treated the same as "not provided" for optional text fields — plain
// HTML forms and the future OCR autofill (Phase 7) both tend to send empty
// strings rather than omitting the key entirely.

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalTrimmedString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().toLowerCase().email("Enter a valid email").optional()
);

// The first appointment is created together with the patient (Reference C:
// "POST /api/patients -> create patient (first visit)") — there's no such
// thing as a patient with zero appointments in this app.
export const createPatientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  opdNo: z.string().trim().min(1, "OPD No is required").max(50),
  age: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(150).optional()),
  phone: optionalTrimmedString(30),
  email: optionalEmail,
  address: optionalTrimmedString(500),
  appointmentDate: z.coerce.date().optional(), // defaults to now in the route
  notes: optionalTrimmedString(2000),
  ocrRawText: optionalTrimmedString(10000),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const createAppointmentSchema = z.object({
  appointmentDate: z.coerce.date().optional(), // defaults to now in the route
  notes: optionalTrimmedString(2000),
  ocrRawText: optionalTrimmedString(10000),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const patientListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;

// The appointment history nested under a patient (GET /api/patients/:id) is
// itself a list — a long-tenured patient can have dozens of visits — so it
// gets the same pagination/search treatment as the patient list itself.
// "search" matches free text in `notes`.
export const appointmentListQuerySchema = z.object({
  search: z.string().trim().max(500).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
