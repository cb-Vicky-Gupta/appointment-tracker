# PG Appointment Tracker — Product Requirements Document

Status: **Planning complete, build not started.**

This PRD is split into **Phases** (build one at a time, in order) and a **Reference**
appendix (schema, API surface, design notes — pulled into whichever phase needs it). Tell me
which phase to start and I'll implement only that slice.

---

## Phased Implementation Plan

### Phase 1 — Data layer ✅ done
**Goal:** a working Postgres DB reachable from the app, with the full schema migrated.
- Add Prisma, write `prisma/schema.prisma` (see Reference A).
- `npx prisma migrate dev` — confirm tables exist.
- `lib/prisma.ts` — Prisma client singleton.

**Deviation from the original plan:** using **Prisma 7**, not the version the PRD assumed —
connection URLs now live in `prisma.config.ts` (not `schema.prisma`), and the client requires
an explicit driver adapter (`@prisma/adapter-pg` wrapping a `pg.Pool`); see `lib/prisma.ts`.
Generated client output moved to `lib/generated/prisma` (gitignored) instead of the default
`app/generated/prisma`, to keep it next to `lib/prisma.ts`.

**Deviation on hosting:** running local Postgres via **Docker** (`docker-compose.yml`,
`docker compose up -d`) instead of Neon for now, per your call — swap `DATABASE_URL` in
`.env` for the real Neon connection string later; nothing else changes.

**Done when:** migration runs clean, tables exist. ✅ Verified — `User`, `RefreshToken`,
`Patient`, `Appointment` tables confirmed via `psql \dt` against the Dockerized DB.

### Phase 2 — Auth API ✅ done
**Goal:** signup/login/refresh/logout work end-to-end via curl/Postman, no UI yet.
- `lib/auth.ts`: JWT sign/verify with `jose`, password hashing with `bcryptjs`,
  refresh-token issuance/lookup/revocation (SHA-256 hash, not bcrypt — see file comments),
  `getUserFromRequest(req)` (Authorization header first, cookie second — Reference B).
- Routes: `POST /api/auth/signup`, `/login`, `/refresh`, `/logout` (Reference B).
- `GET /api/me` added early (read-only) as the protected stub route to smoke-test the flow;
  `PATCH /api/me` still lands in Phase 9.
- Zod schemas for signup/login bodies in `lib/validation.ts`.
- `lib/api-response.ts` — shared JSON error helpers.

**Done when:** ✅ Verified via curl — signup issues tokens; `/api/me` returns 401 with no
token and 200 with a valid access token; duplicate signup → 409; wrong password → 401;
refresh issues a new access token; logout revokes the refresh token row (confirmed in
Postgres) and a second refresh with the same token then returns 401. `passwordHash` is never
present in any API response (confirmed) and is bcrypt-hashed at rest (confirmed via `psql`).

### Phase 3 — Login/signup UI ✅ done
**Goal:** real pages wired to the Phase 2 API; no theme/design polish yet.
- `lib/auth-context.tsx` — `AuthProvider`/`useAuth()`: access token in a ref (memory-only,
  never localStorage/cookie), `user` + `status` in React state, plus `authFetch()` — a fetch
  wrapper that attaches the token and retries once via silent refresh on a 401. Later phases'
  API calls (patients, dashboard, profile) should go through `authFetch`, not raw `fetch`.
  Session restore on mount calls `POST /api/auth/refresh` (cookie-only) → `GET /api/me`.
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx` — plain forms, no design pass yet.
- `app/(dashboard)/dashboard/page.tsx` — placeholder, just proves the session works.
- `app/page.tsx` — redirects to `/dashboard` or `/login` once auth status resolves.
- `app/layout.tsx` wraps the app in `AuthProvider`.

**Done when:** ✅ Verified. `next build` and `next lint`/`tsc --noEmit` are clean, all routes
render. Confirmed via curl (simulating exactly what the browser does): signup sets the
httpOnly refresh cookie → a cookie-only `POST /api/auth/refresh` (no body token, the same
call `AuthProvider` makes on mount/reload) returns a fresh access token → logout clears the
cookie → a subsequent cookie-only refresh fails. Manual browser click-through (signup → land
on dashboard → reload stays logged in → logout → redirected to `/login`) still recommended
before moving on, since this was verified via curl/build rather than a live browser session.

### Phase 4 — Theme system ✅ done
**Goal:** gender + mode drive the whole app's look via one attribute.
- `lib/theme-context.tsx` — `ThemeProvider`/`useTheme()`. `themeMode` is a **derived** value
  (local override > signed-in user's saved `themeMode` > system preference), not effect+
  setState — the only real effect writes the resolved `data-theme` attribute to `<html>`.
- `app/globals.css` — full CSS variable set for `other|male|female` × `light|dark` (6 palettes;
  `other` is the neutral pre-login/`OTHER`-gender default, not in the original PRD table but
  needed since `Gender` includes `OTHER`). Mapped to Tailwind utilities via `@theme inline`
  (`bg-bg`, `text-text`, `bg-primary`, etc.) — no hardcoded Tailwind colors anywhere.
- `app/layout.tsx` sets a static `data-theme="other-light"` on `<html>` (no inline
  pre-hydration script was needed/possible here: gender isn't known until the client-side
  session check resolves, and every page already blocks on a loading state until then, so
  there's no flash-of-wrong-theme to prevent).
- Manual light/dark toggle (`components/ui/ThemeToggle.tsx`) is local-only (localStorage) —
  explicitly deferred to Phase 9's `PATCH /api/me`, per the original plan.

**Deviation — pulled design-pass work forward:** you asked for the UI to look aesthetic now
rather than waiting for Phase 10, so this phase also shipped: a Fraunces/Geist type pairing,
an asymmetric two-pane `AuthShell` for login/signup (`components/layout/AuthShell.tsx`), a
Lucide-icon brand mark (`components/icons/PulseMark.tsx`, per your instruction to use Lucide
rather than hand-drawn SVGs), a custom pulsing-heartbeat `Spinner` (not `animate-spin`), a
matching custom favicon (`app/icon.svg`), and `cursor-pointer` on every interactive button.
Phase 10 still remains for whatever's left (sidebar dashboard shell, further micro-copy pass).

**Done when:** ✅ Verified via curl — signup as `MALE`/`FEMALE`/`OTHER` round-trips the right
`gender`/`themeMode`, which is exactly what `ThemeProvider` keys off. `tsc --noEmit`, `eslint`,
and `next build` all clean. Manual browser check (does the toggle instantly repaint every
themed surface with no flash) is still recommended, since this was verified via curl/build.

### Phase 5 — Patient & appointment API ✅ done
**Goal:** the core domain logic, fully testable without UI.
- `lib/patients.ts` — `findOwnedPatient`/`findOwnedAppointment`: the only two places that look
  up a Patient/Appointment by bare id, both scoped to `userId`. Route handlers go through
  these rather than calling `prisma.patient.findUnique` directly (Reference D's convention,
  made structural instead of just a rule to remember).
- `GET /api/patients?search=&page=` — matches `opdNo` by prefix and `name` by
  case-insensitive contains; returns `visitCount`/`lastVisitAt` per patient (from
  `_count.appointments` + latest `appointments` row, not fetch-all-and-count-in-JS).
- `POST /api/patients` — creates the patient **and** its first appointment together in one
  transaction (Reference C: "create patient (first visit)" — there's no such thing as a
  patient with zero visits here).
- `GET /api/patients/:id` — patient + full appointment history, newest first. 404 (never 403)
  whether the patient doesn't exist or just belongs to someone else.
- `POST /api/patients/:id/appointments` — always `appointment.create`, never `update`; also
  touches the patient's `updatedAt` (an empty `update()` call — Prisma bumps `@updatedAt` on
  every `update` invocation regardless of whether data changed) so patient lists sort by
  most-recently-active without a separate query.
- `GET /api/appointments/:id` — scoped through `patient.userId`.

**Reference J resolved:** used the existing `GET /api/patients?search=` endpoint itself as the
match-suggestion mechanism — no separate "match" endpoint needed. The client flow (Phase 6/7)
is: search by OPD no/name first, show candidates, let the resident explicitly choose "add to
this patient" (`POST .../appointments`) or "this is a new patient" (`POST /api/patients`).
Nothing on the server ever auto-merges into an existing patient.

**Done when:** ✅ Verified via curl with two real signed-up users, A and B: B's search for A's
OPD number returns empty, `GET`/`POST .../appointments` on A's patient both 404 for B, and A
adding a second appointment produces 2 intact appointment rows (not 1 overwritten). Validation
errors (400) and missing-auth (401) also confirmed. `tsc --noEmit`, `eslint`, and `next build`
all clean. Test users/patients cleaned up afterward.

### Phase 6 — Patient list/search + detail UI ✅ done
**Goal:** the PG user can browse and search their own patients and see full history.
- Installed **TanStack Query** (per Reference A's original tech-stack choice, not used yet in
  earlier phases) — `lib/query-client.tsx` + `lib/hooks/use-patients.ts` /
  `use-patient-detail.ts`. `lib/hooks/use-debounced-value.ts` debounces the search inputs.
- `lib/use-require-auth.ts` + `components/layout/AppHeader.tsx` — extracted the
  loading/redirect guard and header out of the dashboard page (Phase 3/4) so `/patients` and
  `/patients/:id` don't duplicate them; `dashboard/page.tsx` now uses both too.
- `app/(dashboard)/patients/page.tsx` — search box (name or OPD no.) → `GET
  /api/patients?search=&page=`, `PatientCard` result cards (name, OPD no., last visit date,
  visit count), pagination, empty state.
- `app/(dashboard)/patients/[id]/page.tsx` — patient header fields + full appointment history
  via `AppointmentEntry` (newest first, OCR raw text collapsed behind a toggle where present).

**Deviation — pagination/search hardening (your mid-phase request):** the appointment history
nested under a patient was originally going to return everything unpaginated. Since a
long-tenured patient can accumulate dozens of visits, `GET /api/patients/:id` now also takes
`?page=&search=` (search matches free text in `notes`) and returns `appointmentsMeta`; the
detail page got its own search box + pagination controls for the history list, mirroring the
patient list. Verified up to 26 appointments on one patient: page 1 returns 20, page 2 returns
the remaining 6, and `?search=` correctly isolates a single matching visit.

**Done when:** ✅ Verified via curl — partial name search ("ramesh" → "Ramesh Kumar") and OPD
prefix search ("40" → "4021") both return the right patient; patient detail returns every
appointment (paginated, not just the latest). `tsc --noEmit`, `eslint`, `next build` all clean.
Test data cleaned up afterward. Manual browser click-through still recommended, since this
was verified via curl/build rather than a live session.

### Phase 7 — Prescription OCR → autofill
**Goal:** scan a prescription photo, get an editable pre-filled appointment form.
- Image capture/upload (`<input capture>` for mobile camera), image stays client-side only.
- Tesseract.js in a Web Worker; regex extraction for OPD no, phone, date, age
  (Reference E, patterns in item 3).
- "Scanned — please verify details" messaging; every field editable.
- Wire into Phase 5's create-or-append flow (match suggestion, not auto-merge) and Phase 6's
  UI.
**Done when:** a printed OPD slip photo populates most fields correctly; a messy handwritten
one still lets you fill in manually without the flow breaking; the image itself is never
sent to the server (verify in Network tab).

### Phase 8 — Dashboard stats
**Goal:** at-a-glance numbers on login.
- `GET /api/dashboard/stats` — single Prisma aggregate query (not fetch-all-and-count-in-JS),
  scoped to `userId`.
- Cards: total patients, total appointments, today's appointments, this week's appointments.
**Done when:** the numbers match manual counts in Prisma Studio for a test user, and stay
correct after adding a patient/appointment.

### Phase 9 — Profile page
**Goal:** user can edit their own profile, including the field that drives theme.
- `GET/PATCH /api/me` (name, gender, themeMode).
- Profile UI: editable name, gender selector (flips theme), persisted light/dark toggle.
**Done when:** changing gender in the profile page changes the theme app-wide and survives a
reload (i.e. it's actually persisted via `PATCH /api/me`, not just local state).

### Phase 10 — Design pass
**Goal:** stop looking like a generic AI-generated SaaS template (Reference G).
- Typography pairing (non-Inter), asymmetric auth layout, sidebar dashboard, non-default
  blue/pink hues, custom favicon/spinner/icons, real micro-copy.
**Done when:** every screen reads var(--primary) etc. (no hardcoded Tailwind colors), and a
fresh look confirms none of the "generic AI SaaS" tells from Reference G remain.

---

## Reference

### A. Tech stack (all free-tier)

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

#### Database schema (Prisma) — used in Phase 1

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

### B. Auth design — used in Phase 2/3

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

**Env var:** `JWT_ACCESS_SECRET` (HS256 signing secret for access tokens) — a local dev value
was generated and written to `.env` (gitignored); generate your own before deploying, e.g.
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### C. REST API surface — used in Phases 2, 5, 8, 9

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

### D. Per-user data isolation — used in Phase 5 onward

Every Prisma query for patients/appointments includes `where: { userId: currentUser.id }`
(or via the nested relation). Convention: **never write a `patient` or `appointment` query
without a userId filter**, even internal helper functions.

### E. OCR design & caveat — used in Phase 7

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

### F. Gender-based theme — used in Phase 4/9/10

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

### G. Making it not look AI-generated — used in Phase 10

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

### H. Folder structure

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

### I. What this app is (product summary)

A web app for medical college PG students/residents to manage their own patient
appointment log. Each PG user has their own private list of patients. They can scan a
prescription photo to auto-fill a form, and every time the same patient returns, a **new
appointment record** is added under that patient — history is never overwritten.

Built to be reused later as a mobile app, so **all business logic lives behind a REST API**,
never directly in page components.

### J. Open decision — flagged, not yet resolved (blocks Phase 5)

Should "same patient comes again" be matched automatically (by OPD no) or should the PG
student always search first and explicitly pick "add appointment to this existing patient"
vs "new patient"? Auto-matching on OPD no is convenient but risky if OPD numbers get
reused/mistyped.

**Recommendation:** make the match a **suggestion** ("Found existing patient Ramesh Kumar,
OPD 4021 — add appointment to this patient? Y/N") rather than a silent merge. Confirm this
before implementing Phase 5's create-or-append logic.
