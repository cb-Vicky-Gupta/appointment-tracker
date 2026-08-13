import { z } from "zod";

// Shared Zod schemas for API request bodies — these are the single source of
// truth for both the API routes and (later) any mobile client hitting the
// same endpoints.

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

// "OTHER" stays a valid Gender at the DB/enum level (it's still the neutral
// pre-login theme default, Reference F) but is no longer offered as a
// choice on either signup or the profile page — every account is MALE or
// FEMALE by explicit user choice.
export const signupGenderSchema = z.enum(["MALE", "FEMALE"]);
export const profileGenderSchema = z.enum(["MALE", "FEMALE"]);

export const studentTypeSchema = z.enum(["UG", "PG"]);

// Superset of both UG's and PG's year options (Profile page) — UG has more
// years (MBBS/BDS run longer than a PG residency), so this is the union of
// both dropdowns rather than two separate strict enums; which subset the UI
// actually offers depends on `studentType`, but the server doesn't need to
// police that pairing for a descriptive, non-critical field like this one.
export const yearSchema = z.enum([
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "Final Year",
  "Internship",
]);

// "" is treated the same as "not provided" for optional text fields — plain
// HTML forms tend to send empty strings rather than omitting the key
// entirely (used by both the profile and patient/appointment schemas below).
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalTrimmedString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

// --- Signup (3-step: start -> verify-otp -> complete) ----------------------

export const startSignupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  gender: signupGenderSchema,
});
export type StartSignupInput = z.infer<typeof startSignupSchema>;

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const completeSignupSchema = z.object({
  signupToken: z.string().min(1, "signupToken is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type CompleteSignupInput = z.infer<typeof completeSignupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// --- Forgot password (3-step, mirrors signup: forgot -> verify-otp ------
// -> reset). verify-otp reuses verifyOtpSchema above — identical {email,
// otp} shape.

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "resetToken is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// PATCH /api/me (Phase 9, + professional-details fields added afterward) —
// every field optional (a caller only sends what it's changing); at least
// one must be present or there's nothing to update. Gender here uses the
// same MALE/FEMALE-only schema as signup — "OTHER" is never a choice a user
// makes themselves, only ever a pre-signup default (Reference F).
export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120).optional(),
    gender: profileGenderSchema.optional(),
    themeMode: z.enum(["light", "dark"]).optional(),
    specialization: optionalTrimmedString(120),
    institute: optionalTrimmedString(200),
    studentType: z.preprocess(emptyToUndefined, studentTypeSchema.optional()),
    year: z.preprocess(emptyToUndefined, yearSchema.optional()),
    phone: optionalTrimmedString(30),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update" });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

// --- Admin panel (Plan Phase B) ---------------------------------------------

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

// Every field optional (a caller only sends the one action it's taking);
// at least one must be present. `forceLogout` is a trigger, not a field to
// persist — it's true-or-absent, never explicitly false.
export const adminUpdateUserSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
    forceLogout: z.literal(true).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No action specified" });
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

// --- Patients & appointments (Phase 5) -------------------------------------
// (emptyToUndefined/optionalTrimmedString are declared near the top of this
// file now — shared with updateMeSchema above.)

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
