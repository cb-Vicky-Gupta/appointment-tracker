# PG Appointment Tracker — Product Requirements Document

Status: **Planning complete, build not started.** Implement in phases per Section 9 —
do not build everything at once.

---

## 0. What this app is

A web app for medical college PG students/residents to manage their own patient
appointment log. Each PG user has their own private list of patients. They can scan a
prescription photo to auto-fill a form, and every time the same patient returns, a **new
appointment record** is added under that patient — history is never overwritten.

Built to be reused later as a mobile app, so **all business logic lives behind a REST API**,
never directly in page components.

---

## 1. Tech stack (all free-tier)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | already known |
| DB | PostgreSQL on Neon.tech free tier | as requested |
| ORM | Prisma | as requested |
| Styling | Tailwind CSS + CSS variables for theming | free, no paid UI kit |
| Auth | Custom JWT (access + refresh token), NOT NextAuth | NextAuth is cookie/session-first and awkward for a future mobile app; hand-rolled JWT with `jose` + `bcryptjs` works identically from web fetch and mobile HTTP client |
| OCR | Tesseract.js (client-side, runs in browser, free, no API key) | free-tier requirement rules out Google Vision / AWS Textract |
| Image storage | **None** — image is discarded after OCR | patient photos never uploaded or persisted; only parsed text fields are saved |
| Hosting | Vercel | as requested |
| Validation | Zod | shared schemas between API routes and future mobile app |
| State/data fetching | TanStack Query (React Query) | works identically if screens are ported to React Native later |

Everything above has a genuinely free tier at reasonable scale (a few hundred users, low
image volume). Flag to revisit if patient volume gets large: Neon free tier caps storage at
0.5GB and compute hours — fine for a student project, not for a real hospital system.

---

## 2. Why "OCR scan a prescription" needs a caveat

Prescriptions are usually **handwritten**. Tesseract.js is good at printed text (a
prescription header/footer template, a printed OPD slip, a computer-generated report) but
weak at doctor handwriting. Design the feature as:

1. User selects/photographs the prescription — stays entirely in the browser, in memory
   (e.g. a `File`/`Blob` object or an `<img>` preview), never sent to the server.
2. Tesseract.js runs OCR **client-side** (no server cost, no privacy issue sending images to
   a third-party OCR API, and no image ever leaves the device).
3. Extracted raw text is pattern-matched (regex) for likely fields: OPD No
   (`OPD\s*[:#-]?\s*(\d+)`), phone (10-digit pattern), date
   (`\d{1,2}[/-]\d{1,2}[/-]\d{2,4}`), age (`\b\d{1,3}\s*(yrs?|years?|y)\b`).
4. Pre-fill the form with whatever matched; **leave everything editable** — this is
   convenience autofill, not a guarantee. Say this explicitly in the UI ("Scanned — please
   verify details") so it doesn't feel broken when handwriting isn't recognized.
5. On submit, only the confirmed **text fields** are sent to the API — the image object
   itself is simply dropped/garbage-collected once OCR has run. Nothing binary ever touches
   Postgres, Vercel, or any storage bucket.

If budget ever exists, Google Cloud Vision's handwriting detection is meaningfully better,
but that's a paid API past a small free quota.

---

## 3. Database schema (Prisma)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

model User {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique
  passwordHash String
  gender       Gender    @default(OTHER)
  themeMode    String    @default("light") // "light" | "dark"
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  patients     Patient[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// A Patient belongs to exactly one PG user (their own patient list).
// Same real-world patient visiting a different PG user again = a separate Patient row
// for that PG user, by design — each user's list is independent.
model Patient {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  name         String
  age          Int?
  opdNo        String
  phone        String?
  email        String?
  address      String?

  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  appointments Appointment[]

  @@index([userId, opdNo])
  @@index([userId, name])
}

// Every visit = a new Appointment row. Nothing here overwrites a previous one.
model Appointment {
  id                 String   @id @default(cuid())
  patientId           String
  patient             Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  appointmentDate     DateTime
  ocrRawText          String?   // optional: keep raw OCR text for later debugging/re-parsing
                                  // (the prescription image itself is never stored anywhere)
  notes               String?

  createdAt           DateTime @default(now())

  @@index([patientId])
}
```

Key design point ("same patient comes again → add next appointment, don't replace"): the
"search by OPD no / name" step **finds an existing `Patient` row** for that same logged-in
user, and appointment creation always does `appointments.create(...)`, never `update`. If no
existing patient matches, create a new `Patient` first, then its first `Appointment`.

---

## 4. Auth design (works for web now, app later)

- `POST /api/auth/signup` — body: `{ name, email, password, gender }`. Hash password with
  bcryptjs, create user, return `{ accessToken, refreshToken, user }`.
- `POST /api/auth/login` — body: `{ email, password }`. Verify, return same shape.
- `POST /api/auth/refresh` — body: `{ refreshToken }`. Issue new access token.
- `POST /api/auth/logout` — invalidate refresh token (delete row).

Access token: short-lived JWT (15 min), signed with `jose`, contains `{ userId }`.
Refresh token: long-lived (30 days), stored hashed in `RefreshToken` table so it can be
revoked.

On web: store access token in memory (React context) + refresh token in an httpOnly cookie.
On future mobile app: store both in secure storage (Keychain/EncryptedSharedPreferences) and
send access token as `Authorization: Bearer <token>` — **same API, zero backend changes.**

Every protected API route reads the bearer token via a shared `getUserFromRequest(req)`
helper in `lib/auth.ts` — this is the one function that has to work identically for
cookie-based web calls and header-based mobile calls, so write it to check the
`Authorization` header first, cookie second.

---

## 5. REST API surface (design this before any UI)

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

GET    /api/me                      -> current user profile
PATCH  /api/me                      -> update profile (name, gender, themeMode)

GET    /api/patients?search=&page=  -> search by name or opdNo, paginated, scoped to userId
POST   /api/patients                -> create patient (first visit)
GET    /api/patients/:id            -> patient + all appointments (history)

POST   /api/patients/:id/appointments   -> add a new appointment to existing patient
GET    /api/appointments/:id            -> single appointment detail

POST   /api/ocr/parse               -> (optional) if OCR ever moves server-side; for now
                                        this can literally be a no-op since Tesseract runs
                                        client-side

GET    /api/dashboard/stats         -> { totalPatients, totalAppointments, todayAppointments,
                                          thisWeekAppointments } scoped to userId
```

Every list/detail endpoint filters by the authenticated `userId` — never trust a
client-supplied user id.

---

## 6. Feature-by-feature build notes

### Signup/Login
Standard email+password. Ask gender at signup (required, since it drives theme). Store
`gender` on `User`.

### Prescription upload → autofill → appointment form
1. Upload image (drag-drop or camera capture on mobile browsers via `<input capture>`).
2. Run Tesseract.js in a Web Worker so the UI doesn't freeze.
3. Regex-extract candidate fields (see Section 2).
4. Populate a form with: Name, Age, OPD No, Date, Address, Phone, Email — all editable.
5. On submit: check if a `Patient` with the same `opdNo` (or name+phone match) already
   exists for this user.
   - If yes → `POST /api/patients/:id/appointments` (append).
   - If no → `POST /api/patients` then create its first appointment.

### Search
Single search box hitting `GET /api/patients?search=`, matching `opdNo` (exact/prefix) OR
`name` (case-insensitive `contains`, use Postgres `ILIKE` via Prisma
`{ contains, mode: 'insensitive' }`). Show results as cards with patient name, OPD no, last
visit date, and total visit count; tapping opens full appointment history for that patient.

### Per-user data isolation
Every Prisma query for patients/appointments includes `where: { userId: currentUser.id }`
(or via the nested relation). Convention: **never write a `patient` or `appointment` query
without a userId filter**, even internal helper functions.

### Profile section
Editable name, gender (changing this flips the theme), and a manual light/dark toggle that
overrides the system preference but keeps the gender hue.

### Gender-based theme (blue/pink, each with dark+light)
Implement as CSS custom properties, switched by a `data-theme` attribute on `<html>`:

```css
:root[data-theme="male-light"]   { --bg: #f4f8ff; --surface: #ffffff; --primary: #1d4ed8; --text: #0f172a; }
:root[data-theme="male-dark"]    { --bg: #0a1220; --surface: #101a2e; --primary: #5b8def; --text: #e6ecfb; }
:root[data-theme="female-light"] { --bg: #fff5f8; --surface: #ffffff; --primary: #db2777; --text: #1a0e14; }
:root[data-theme="female-dark"]  { --bg: #1a0e14; --surface: #24141d; --primary: #f472b6; --text: #fbe6ee; }
```

`data-theme` = `${genderKey}-${themeMode}`, computed from the logged-in user's stored
`gender` + `themeMode`, set in a root layout `<script>` before hydration to avoid a flash of
wrong theme. Every component should reference `var(--primary)` etc., never a hardcoded
Tailwind color, so the whole app repaints from one attribute change.

### Dashboard
Cards for: total patients, total appointments logged, today's appointments, this week's
appointments. Pull from `GET /api/dashboard/stats`. Keep it a single Prisma aggregate query
(`count`, filtered by date ranges) rather than fetching all rows and counting in JS.

---

## 7. Making it not look AI-generated

The single biggest tell is the "generic AI SaaS" look: centered hero, `indigo-600` to
`violet-600` gradient button, Inter font, rounded-2xl cards with a soft shadow, a 3-column
feature grid with an icon-circle-title-paragraph pattern. Avoid all of that specifically:

- **Typography**: pick an unusual pairing, e.g. a slightly serif or slab display font for
  headings (`Fraunces`, `Zilla Slab`, or `Space Grotesk`) paired with a plain body font —
  not Inter for both. Google Fonts, free.
- **Layout**: break the centered-card default. Use an asymmetric two-pane layout for
  login/signup (form on one side, a patterned/illustrated panel with a stat or quote on the
  other), and a sidebar-based dashboard instead of a top-nav-only layout.
- **Color**: don't use Tailwind's default indigo/violet/purple at all — the blue/pink theme
  above already forces this; make sure the blue isn't `#4f46e5`-style default indigo (used
  `#1d4ed8`/`#db2777` above deliberately).
- **Details**: custom favicon, a distinct loading spinner (not the default Tailwind
  `animate-spin` circle — try a pulsing OPD-slip icon or a simple custom SVG), real
  micro-copy instead of Lorem-ipsum-adjacent phrasing ("Add today's patient" not "Get
  Started").
- **Icons**: mix in 2–3 custom-drawn simple SVGs (e.g. a stethoscope or file icon) instead of
  100% Lucide/Heroicons defaults everywhere.

None of this changes functionality — it's purely CSS/asset choices, so build features first,
then do a design pass.

---

## 8. Suggested folder structure

```
/app
  /(auth)/login/page.tsx
  /(auth)/signup/page.tsx
  /(dashboard)/dashboard/page.tsx
  /(dashboard)/patients/page.tsx
  /(dashboard)/patients/[id]/page.tsx
  /(dashboard)/profile/page.tsx
  /api/auth/[...]/route.ts
  /api/patients/route.ts
  /api/patients/[id]/route.ts
  /api/patients/[id]/appointments/route.ts
  /api/dashboard/stats/route.ts
/lib
  auth.ts        // JWT sign/verify, getUserFromRequest
  prisma.ts       // Prisma client singleton
  ocr.ts          // Tesseract wrapper + regex field extraction
  validation.ts   // Zod schemas shared by API routes
/components
  theme/ThemeProvider.tsx
  patients/PatientForm.tsx
  patients/PrescriptionUpload.tsx
  dashboard/StatsCards.tsx
/prisma
  schema.prisma
```

---

## 9. Build order (do it in this order, not all at once)

1. Prisma schema + Neon DB connection + `npx prisma migrate dev`.
2. Auth API routes + JWT helper, test with curl/Postman before touching UI.
3. Login/signup pages wired to auth API.
4. Theme system (gender + mode → CSS variables), verify it switches correctly.
5. Patient + appointment API routes (create, list/search, detail, add-appointment).
6. Patient list/search UI + patient detail (appointment history) UI.
7. Prescription upload + Tesseract OCR + autofill form, wired into the create/append flow.
8. Dashboard stats endpoint + UI cards.
9. Profile page.
10. Design pass per Section 7.

---

## 10. Open decision — flagged, not yet resolved

Should "same patient comes again" be matched automatically (by OPD no) or should the PG
student always search first and explicitly pick "add appointment to this existing patient"
vs "new patient"? Auto-matching on OPD no is convenient but risky if OPD numbers get
reused/mistyped.

**Recommendation:** make the match a **suggestion** ("Found existing patient Ramesh Kumar,
OPD 4021 — add appointment to this patient? Y/N") rather than a silent merge. This should be
decided/confirmed before implementing Step 7 of the build order (the search/append flow).
