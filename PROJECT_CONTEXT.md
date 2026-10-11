# Trash Map: Project Context

> The handoff document for every coding session, human or AI. Keep it accurate.
> Last updated: 2026-10-11 (reports read/resolve API, branch `feat/reports-api`, based on `chore/project-foundation`).

## Rules for every coding session

Workflow: **read context → inspect relevant files → plan minimal changes → implement → verify → update this file → report results.**

1. Read `PROJECT_CONTEXT.md` before making project changes.
2. Inspect the actual code before assuming documented functionality exists.
3. Update this file after every meaningful implementation or architectural change.
4. Update a status only after verifying the corresponding work.
5. Record changed files, decisions, tests, and blockers in the change log (section L).
6. Keep documentation consistent with the actual implementation.
7. Never silently change shared API contracts, report types, or database schemas.
8. Avoid unnecessary refactoring and unrelated changes.
9. Never overwrite a teammate's uncommitted work.
10. Prefer small, reviewable changes.
11. If a change affects Aashish's frontend contract, document the change and its migration implications.
12. If a requirement is ambiguous, state the assumption or ask before making a risky architectural decision.

Also: this repo uses **Next.js 16.4**. Read the bundled docs in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`).

---

## A. Project overview

- **What:** an open-source web app for reporting garbage hotspots in Mumbai and visualizing them on a heat map.
- **Who it's for:** Mumbai residents who want to report waste; civic volunteers and municipal staff who want to see where unresolved garbage piles up.
- **Context:** Hacktoberfest Hack Day Mumbai × FAIR, about 4 hours of build time. Optimize for the smallest complete end-to-end demo.
- **MVP:**
  1. Upload a garbage photo.
  2. Pick a location or use device geolocation.
  3. Classify the image with the configured Gemma model.
  4. Validate the model output against a JSON schema.
  5. Save report metadata and the image to Supabase.
  6. Show reports on an interactive map.
  7. Show report density as a heat map.
  8. Show unresolved reports with delay-weighted heat intensity.
  9. Generate AI-assisted complaint drafts.
  10. Mark reports as resolved.
  11. Seed 20–30 clearly marked sample reports across Mumbai.
- **Out of scope unless explicitly requested:** authentication, duplicate detection, automatic complaint filing, moderation, notifications.

## B. Team ownership

| Person | Responsibilities |
| --- | --- |
| **Tejas** (coordinator) | Backend architecture, API routes, Supabase schema and storage, AI integration, geospatial logic, testing, final integration, and this document. |
| **Aashish** | UI/UX, frontend components, responsive layouts, visual design, map presentation, and UX polish. |

Collaboration boundaries:
- Aashish builds UI against the **shared types** in `src/types/reports.ts` and the HTTP contracts in section E. UI code must not import server modules.
- Tejas owns everything under `src/app/api/`, `src/lib/` (except `src/lib/utils.ts`), and `supabase/`.
- A contract change needs a heads-up to the other person and an entry in section L.

## C. Technology and architecture

| Concern | Choice | Installed version |
| --- | --- | --- |
| Framework | Next.js App Router, Turbopack, Cache Components on | `next@16.4.0`, `react@19.3.0` |
| Language | TypeScript, `strict: true` | `typescript@5` |
| Styling | Tailwind CSS v4 + shadcn/ui (`base-nova` style, Base UI primitives, lucide icons) | `tailwindcss@4`, `shadcn@4` |
| Database and storage | Supabase Postgres + Storage | `@supabase/supabase-js@2.117` |
| Maps | Leaflet + leaflet.heat, OpenStreetMap tiles | `leaflet@1.9.4`, `leaflet.heat@0.2.0` |
| AI | Google Gen AI SDK, Gemma model set by env | `@google/genai@2.28` |
| Validation | Zod 4 | `zod@4.6` |
| Lint | ESLint 9 flat config (`eslint-config-next`) | |
| Tests | Vitest, Node environment (`vitest.config.mts`) | `vitest@5.0.3` |
| Package manager | npm (`package-lock.json`) | |

Directory layout (only folders that exist now, plus planned ones marked):

```text
src/
  app/
    api/health/route.ts      GET: reports which integrations are configured (booleans only)
    api/reports/route.ts     GET: list reports (implemented). POST: create (planned)
    api/reports/[id]/route.ts  PATCH: update status / resolve (implemented)
    api/classify/            planned: classify an image (preview)
    api/complaints/          planned: draft a complaint
    layout.tsx, page.tsx     minimal landing page (placeholder copy)
    globals.css              Tailwind + shadcn theme tokens
  components/
    ui/                      shadcn components (button.tsx so far)
    map/, reports/           planned: Aashish's feature components
  lib/
    validation/reports.ts    Zod schemas: the source of truth for shared contracts
    validation/api.ts        Zod schema for API error bodies
    env.ts                   server-only env validation (throws ConfigError)
    api-error.ts             server-only helpers for safe JSON error responses
    supabase/server.ts       server-only service-role Supabase client (lazy)
    reports/repository.ts    server-only data access for reports (queries, row validation, DatabaseError)
    ai/                      planned: Gemma classification + complaint drafting
    utils.ts                 shadcn `cn()` helper
  types/reports.ts           TypeScript types inferred from the Zod schemas
supabase/
  migrations/20261011000000_create_reports.sql
  seed.sql
public/samples/sample-report.svg   placeholder image used by seed rows
tests/
  api/                       route handler tests (Supabase mocked)
  validation/                Zod contract tests
  helpers/                   fake Supabase query builder, report row fixture
  stubs/server-only.ts       empty stand-in for `server-only` under Vitest
vitest.config.mts
```

Server/client boundaries:
- Every module that reads secrets starts with `import "server-only"` (`env.ts`, `api-error.ts`, `supabase/server.ts`, `reports/repository.ts`). Importing one from a Client Component fails the build.
- Route handlers stay thin: parse and validate input, call `src/lib/reports/repository.ts`, and map errors with `handleUnknownError()`. Rows read from the database are validated against `reportSchema` before they are returned.
- **The browser never talks to Supabase directly in the MVP.** All reads and writes go through `/api/*` route handlers using the service-role key. This means no RLS policies to write during the hackathon and no exposed keys.
- Route handlers that read env or the DB at request time must not be prerendered. With Cache Components, call `await connection()` (from `next/server`) or read the request before touching env/DB. See `api/health/route.ts`.
- Leaflet touches `window`, so map components must be Client Components loaded with `next/dynamic` and `ssr: false`.

## D. Current implementation status

Statuses: Not started · In progress · Implemented · Tested · Blocked. "Tested" means a test or manual verification was actually run.

| Feature | Status | Notes |
| --- | --- | --- |
| Project scaffold (Next.js, TS strict, Tailwind, ESLint, shadcn) | Tested | `npm run check` and `npm run build` pass; `/` returns 200 under `next start`. |
| Shared contracts (Zod schemas + types) | Tested | Covered by `tests/validation/reports.test.ts`. |
| Env validation + `/api/health` | Tested | With no `.env.local`, `/api/health` returned `{"ok":true,"configured":{"supabase":false,"gemini":false}}`. |
| `GET /api/reports` (list, filters, pagination) | Tested (mocked DB only) | Unit tests with a fake Supabase client, plus smoke tests against `next start` for 400/503/500 paths. **Never run against a real Supabase database.** |
| `PATCH /api/reports/[id]` (status + `resolved_at`) | Tested (mocked DB only) | Same as above. Real PostgREST behavior of `.neq().maybeSingle()` on update is unverified. |
| Supabase migration (`reports` table, `report-images` bucket) | Implemented | Not yet applied to a real Supabase project. Blocked on credentials. |
| Seed data (25 sample reports) | Implemented | Not yet run against a database. |
| 1. Photo upload | Not started | |
| 2. Location selection / geolocation | Not started | |
| 3. Gemma classification | Not started | Blocked on `GEMINI_API_KEY` and on verifying a Gemma model id with image input. |
| 4. Classification schema validation | In progress | Schema defined (`classificationResultSchema`); not yet wired to the model. |
| 5. Save report + image to Supabase | Not started | Blocked on Supabase credentials. |
| 6. Map with report markers | Not started | Backend data source `GET /api/reports` is ready (mocked-DB tested). |
| 7. Density heat map | Not started | |
| 8. Delay-weighted heat for unresolved reports | Not started | Proposed formula in section H. |
| 9. Complaint drafts | Not started | Contract defined. |
| 10. Mark as resolved | In progress | Backend `PATCH /api/reports/[id]` implemented and unit tested; UI button not started. |
| 11. Sample data | Implemented | See seed row above. |

## E. Shared contracts

**Source of truth:** `src/lib/validation/reports.ts` and `src/lib/validation/api.ts`. `src/types/reports.ts` re-exports the inferred types. Frontend code should import types from `@/types/reports`. It may import the schemas or constants (for example `REPORT_CATEGORIES`) from `@/lib/validation/reports` for client-side form validation.

Enums:
- `ReportCategory`: `plastic | organic | construction | mixed | other`
- `ReportStatus`: `pending | in_progress | resolved`
- `Severity`: `low | medium | high` (AI output only; not a DB column)

`Report` (what the API returns; matches a DB row):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid string | |
| `image_url` | string | Public Supabase Storage URL, or `/samples/sample-report.svg` for seed rows (so it can be relative) |
| `latitude`, `longitude` | number | WGS84 |
| `category` | `ReportCategory` | |
| `description` | string \| null | ≤ 1000 chars. AI description or user note |
| `confidence` | number \| null | 0–1 |
| `status` | `ReportStatus` | |
| `created_at` | ISO datetime with offset | |
| `resolved_at` | ISO datetime \| null | Non-null iff `status = resolved` |
| `ai_analysis` | `ClassificationResult` \| null | Raw validated model output. `null` for seed rows |
| `is_sample` | boolean | `true` for demo data. UI should label these |

`ClassificationResult` (the JSON the model must return; validated before use):
`{ is_garbage: boolean, category: ReportCategory, confidence: 0–1, description: string (1–500), severity: Severity }`

Image rules: JPEG, PNG, or WebP, 1 byte to 4 MB (`MAX_IMAGE_BYTES`). Vercel caps request bodies at 4.5 MB, so the frontend should downscale large photos before upload.

HTTP API:

| Method + path | Status | Request | Success response |
| --- | --- | --- | --- |
| `GET /api/health` | **Implemented** | none | `200 { ok: true, configured: { supabase: boolean, gemini: boolean } }` |
| `GET /api/reports` | **Implemented** | query, see below | `200 { reports: Report[], pagination: { limit, offset, has_more } }` |
| `PATCH /api/reports/[id]` | **Implemented** | JSON `{ status }`, see below | `200 { report: Report }` |
| `POST /api/reports` | Planned (returns 405 today) | `multipart/form-data`: `image` (File), `latitude`, `longitude`, optional `description` (`createReportFieldsSchema` + `imageFileSchema`) | `201 { report: Report }` |
| `POST /api/classify` | Planned | `multipart/form-data`: `image` | `200 { classification: ClassificationResult }` |
| `POST /api/complaints` | Planned | JSON `{ report_id }` (`complaintDraftRequestSchema`) | `200 { draft: { report_id, subject, body, generated_at } }` |

**`GET /api/reports`** (`listReportsQuerySchema`, type `ListReportsResponse`)
- Query parameters, all optional:
  - `status`: one of `pending | in_progress | resolved`.
  - `category`: one of the five categories.
  - `limit`: integer 1–500, default **500** (`MAX_REPORTS_PAGE_SIZE`).
  - `offset`: integer ≥ 0, default 0.
- Unknown parameters are ignored. An empty value such as `?status=` is invalid and returns 400.
- Order: `created_at` newest first, then `id` ascending as a tiebreak.
- `has_more` is true when at least one more row exists after this page. To fetch the next page, use `offset + limit`.
- Example: `GET /api/reports?status=pending&limit=2` returns

  ```json
  {
    "reports": [
      {
        "id": "3f1c2b4a-1d2e-4f5a-8b6c-7d8e9f0a1b2c",
        "image_url": "/samples/sample-report.svg",
        "latitude": 19.0178, "longitude": 72.8478,
        "category": "mixed",
        "description": "[SAMPLE] Overflowing bins outside Dadar station",
        "confidence": null, "status": "pending",
        "created_at": "2026-09-29T06:48:00.123456+00:00", "resolved_at": null,
        "ai_analysis": null, "is_sample": true
      }
    ],
    "pagination": { "limit": 2, "offset": 0, "has_more": true }
  }
  ```

**`PATCH /api/reports/[id]`** (`reportIdSchema`, `updateReportStatusSchema`, type `UpdateReportResponse`)
- `id` must be a UUID. The body must be JSON `{ "status": "pending" | "in_progress" | "resolved" }`.
- `resolved`: sets `resolved_at` to the server's current time. If the report is already resolved, it is returned unchanged and keeps its original `resolved_at`, so the call is idempotent.
- `pending` or `in_progress`: sets the status and clears `resolved_at` to `null`. This also reopens a resolved report.
- Returns 404 `NOT_FOUND` if no report has that id.
- Example: `PATCH /api/reports/3f1c…1b2c` with `{"status":"resolved"}` returns `200 { "report": { …, "status": "resolved", "resolved_at": "2026-10-11T07:30:00+00:00" } }`.

Error responses produced by these endpoints:

| Situation | Status | Body |
| --- | --- | --- |
| Bad query, id, or body field | 400 | `{ error: { code: "VALIDATION_ERROR", message, details: { formErrors: string[], fieldErrors: { [field]: string[] } } } }` |
| Body is not JSON | 400 | `{ error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON" } }` |
| Unknown report id | 404 | `{ error: { code: "NOT_FOUND", message: "Report not found" } }` |
| Supabase env vars missing | 503 | `{ error: { code: "CONFIG_MISSING", message, details: { missing: ["NEXT_PUBLIC_SUPABASE_URL", …] } } }` |
| Supabase error, unreachable DB, or a row that fails `reportSchema` | 500 | `{ error: { code: "DATABASE_ERROR", message: "Database request failed" } }` (details are logged server-side only) |
| Unsupported method | 405 | Empty body (Next.js default) |

Errors (every non-2xx response): `{ error: { code, message, details? } }`, where `code` is one of `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFIG_MISSING` (503, `details.missing` lists env var **names**), `AI_UNAVAILABLE` (502), `AI_INVALID_RESPONSE` (502), `STORAGE_ERROR` (500), `DATABASE_ERROR` (500), `INTERNAL_ERROR` (500). Never include secrets or stack traces. Use `apiError()`, `validationError()`, and `handleUnknownError()` from `src/lib/api-error.ts`.

## F. Database and storage

**Exists in the repo as a migration, but has not been applied to any Supabase project yet:** `supabase/migrations/20261011000000_create_reports.sql`
- Enums `report_category`, `report_status` (same values as the Zod enums).
- Table `public.reports`: the columns in section E. `description`, `confidence`, `resolved_at`, and `ai_analysis` are nullable. Check constraints cover lat/lng range, confidence 0–1, description length, and `(status = 'resolved') = (resolved_at is not null)`.
- Index `(status, created_at desc)` for the "unresolved, oldest first" heat-map query.
- RLS is **enabled with no policies**, so anon and authenticated keys can't read or write. Only the service role, used server-side, can.
- Storage bucket `report-images`: **public read**, 4 MB limit, jpeg/png/webp. Planned object key: `reports/<report-uuid>.<ext>`. Uploads happen server-side only.

`supabase/seed.sql`: 25 rows across Mumbai with `is_sample = true` and descriptions prefixed `[SAMPLE]`. It has a mix of statuses and ages from 1 to 30 days. Re-runnable, because it deletes only `is_sample` rows first.

No relationships or other tables. Complaint drafts are generated on demand and not stored (decision in section H).

## G. Environment setup

Variables (see `.env.example`; real values go in `.env.local`, which git ignores):

| Variable | Scope | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public, also read server-side | DB + storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Reserved; unused in the MVP |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | DB + storage |
| `SUPABASE_STORAGE_BUCKET` | server | Defaults to `report-images` |
| `GEMINI_API_KEY` | **server only** | Classification, complaint drafts |
| `GEMINI_MODEL` | server | Gemma model id; no default on purpose |

`getSupabaseEnv()` and `getGeminiEnv()` in `src/lib/env.ts` validate these lazily and throw `ConfigError` listing only variable **names**. Nothing calls external services at build time.

Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`next typegen && tsc --noEmit`), `test` (`vitest run`), `test:watch`, `check` (lint + typecheck + test). Requires Node ≥ 20.9; developed on Node 24.19 and npm 11.17.

Configuration gaps: no Supabase project credentials, no Gemini key, no verified Gemma model id. Migration and seed are not applied yet.

## H. Decisions and constraints

| Decision | Why | Alternatives rejected |
| --- | --- | --- |
| All DB/storage access goes through server route handlers with the service-role key | No auth in scope, so this avoids writing RLS policies and exposing keys | Browser Supabase client with anon key + RLS (more setup, larger attack surface) |
| Zod schemas are the single source of truth; TS types are inferred from them | Runtime validation and types can't drift | Hand-written interfaces plus separate schemas |
| `POST /api/reports` classifies the image **on the server** instead of trusting client-sent classification | The client could forge the AI result | Client calls `/api/classify`, then posts the result |
| `/api/classify` is an optional preview endpoint | Lets the UI show the category before submitting; costs a second model call | Combined only |
| Complaint drafts are not persisted | Keeps scope small; drafts are cheap to regenerate | `complaints` table |
| `GEMINI_MODEL` has no default | Gemma model ids and image support vary by key and region and must be verified | Hard-coding a model id |
| Seed rows use a local placeholder SVG and `is_sample = true` | Clearly fake, and no storage upload needed | Stock photos (licensing, misleading) |
| Images up to 4 MB, JPEG/PNG/WebP | Fits under Vercel's 4.5 MB request body limit | Direct-to-storage signed uploads (more moving parts) |
| `is_garbage` is part of the classification output | Lets the API reject non-garbage photos | Trusting every upload |
| List pagination uses `limit`/`offset` with `has_more` (fetch `limit + 1` rows), max 500, default 500 | The map wants every report in one call. 500 + 1 stays under Supabase's default 1000-row cap | Exact `count` (extra cost), cursor pagination (more complex than needed) |
| Re-resolving keeps the original `resolved_at`; other statuses clear it | Idempotent resolve, and it always satisfies the DB check constraint | Overwriting `resolved_at` on every resolve |
| Resolve uses a conditional update (`neq status resolved`) followed by a lookup when no row matched | Distinguishes "already resolved" from "not found" without a read-before-write race | Read first, then write |
| DB rows are validated with `reportSchema` before being returned | Schema drift surfaces as a 500 instead of malformed data reaching the UI | Trusting DB output |
| Route tests mock `getSupabaseAdmin` with a fake query builder | No DB is available. Tests cover our logic, not PostgREST | Local Supabase via Docker (heavier; still worth adding later) |

**Proposed** delay-weighted heat (not implemented): for unresolved reports, `weight = min(1, 0.2 + days_open / 14)`, so a new report starts at 0.2 and reaches full intensity after about 11 days open. The density layer uses weight 1 for all reports. This is open to change when feature 8 is built.

Assumptions:
- Mumbai only. The map defaults to center about `19.076, 72.8777`, zoom 11.
- English-only UI and complaint drafts for the MVP.
- Anyone can mark a report resolved (no auth).

Open questions:
- Which Gemma model id is available with image input on the team's key? Verify before building feature 3.
- Should complaint drafts target a specific BMC ward, or stay generic?
- Should non-garbage photos (`is_garbage = false`) be rejected with 400 or saved as category `other`? Current lean: reject.

## I. File ownership and integration boundaries

| Area | Owner | Notes |
| --- | --- | --- |
| `src/app/api/**`, `src/lib/env.ts`, `src/lib/api-error.ts`, `src/lib/supabase/**`, `src/lib/ai/**` | Tejas | Server-only |
| `supabase/**` | Tejas | Schema changes need a new migration file, never edits to an applied one |
| `src/components/**` (except `ui/` generation), `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `public/**` | Aashish | |
| `src/components/ui/**` | Aashish | Add components with `npx shadcn@latest add <name>` |
| `src/lib/validation/**`, `src/types/**` | **Shared** | Tejas edits; any change must be announced and logged in section L |
| `PROJECT_CONTEXT.md`, `README.md`, `package.json` | Shared, coordinated by Tejas | |

Integration rules:
- Frontend calls the HTTP API in section E with `fetch` and types responses with `@/types/reports`. Until an endpoint exists, the UI can use local fixtures shaped like `Report` (for example copied from `seed.sql`). Keep fixtures out of `src/lib/`.
- Client Components must never import anything with `import "server-only"`.
- Work on feature branches and open small PRs into `main`.

## J. Testing and known issues

Verification for the reports API (2026-10-11, branch `feat/reports-api`):
- `npm run check` passed: lint clean, typecheck clean, Vitest **39/39 passed** across 3 files.
  - `tests/api/reports.test.ts`: list defaults, filters, pagination and `has_more`, seven invalid-query cases, config missing (503), DB error (500, no driver message leaked), and a contract-breaking row (500).
  - `tests/api/report-by-id.test.ts`: invalid UUID, non-JSON body, invalid bodies, resolve sets `resolved_at` with the `neq` guard, already-resolved keeps its timestamp, 404 on both paths, reopen clears `resolved_at`, 503, and 500 on update and on lookup failure.
  - `tests/validation/reports.test.ts`: report, query, classification, form, and image schemas.
- Mutation check: deleting the `.neq("status", "resolved")` guard made one test fail. Restoring it brought the suite back to 39/39.
- `npm run build` passed. `/api/reports` and `/api/reports/[id]` are dynamic.
- Smoke test with `next start` and curl:
  - No env vars: GET and PATCH returned 503 `CONFIG_MISSING` with variable names only.
  - Bad query, bad UUID, and non-JSON body each returned 400.
  - `POST /api/reports` returned 405.
  - With `NEXT_PUBLIC_SUPABASE_URL` pointing at an unreachable port and a dummy key, the real supabase-js client failed. GET and PATCH returned 500 `DATABASE_ERROR`. Neither the URL nor the key appeared in responses, and the server logged `DatabaseError: Failed to list reports`.
- **Not run:** any test against a real Supabase database. Real query results, the migration, and the seed are all unverified.

Verification performed for the foundation (2026-10-11):
- `npm run lint` passed with no warnings.
- `npm run typecheck` passed.
- `npm run build` passed. `/` is static, `/api/health` is dynamic.
- `next start` then `curl /api/health` returned `{"ok":true,"configured":{"supabase":false,"gemini":false}}`, and `curl /` returned 200.
- Ad-hoc `npx tsx` script against the Zod schemas passed 8/8 cases: valid and invalid classification, form coercion, lat/lng range, a report row with a Postgres-style timestamp, and image type checks. The script was not committed.

Known issues and risks:
- Route tests use a fake Supabase builder. They verify which filters and updates we send, not that PostgREST returns what we expect. In particular, these are unverified against a live database: `update().select().maybeSingle()` returning `null` when zero rows match, and the timestamp format. Run the manual checks in section K item 1 once Supabase is configured.
- `@types/node` was bumped from `^20` to `^24`, because Vitest 5 requires ≥ 22 and the runtime is Node 24.
- Anyone can change any report's status (no auth, by design). Abuse is possible in a public demo.
- Build prints a warning about a stray `package-lock.json` in the parent home directory. It comes from the local machine, not the repo, and is harmless.
- `npm audit` reports 5 high-severity advisories in transitive dev dependencies from the scaffold. Not triaged.
- npm warns that install scripts for `unrs-resolver`, `protobufjs`, and `@google/genai` are not in `allowScripts`. The build works regardless.
- `leaflet.heat` is old (0.2.0, a global plugin that patches `L`). It needs to be imported after `leaflet` on the client only.
- The SQL migration has not been run against Postgres, so syntax errors there would not have been caught.

## K. Current progress and next actions

Done:
- Foundation: scaffold, dependencies, shadcn, contracts, env validation, health route, migration, seed, docs.
- `GET /api/reports` and `PATCH /api/reports/[id]`, with Vitest setup and tests (mocked DB).

Next, in priority order:
1. **(Tejas) Supabase live:** create the project, apply the migration and seed, and add credentials to `.env.local`. Then verify by hand:
   - `curl /api/health` shows `supabase: true`.
   - `curl /api/reports` returns 25 sample rows with `has_more: false`.
   - `?status=resolved` returns 4 rows.
   - PATCH a pending row to `resolved` twice: `resolved_at` is set once and unchanged the second time.
   - PATCH it back to `pending`: `resolved_at` becomes `null`.
   - PATCH a random UUID: 404.
2. **(Aashish, in parallel) Map UI:** a Leaflet client component with markers and a heat layer. It can call `GET /api/reports` now, which returns 503 until Supabase is configured, or use `Report[]` fixtures.
3. **(Tejas) AI + create flow:** verify a Gemma model id with image input, build `src/lib/ai/` classification with schema validation, then `POST /api/reports` (upload, classify, insert) and `/api/classify`.
4. Report form UI (photo, geolocation or map pin, submit). Depends on item 3's contract, which is already defined.
5. Delay-weighted heat (feature 8), resolve button UI (feature 10, which calls `PATCH /api/reports/[id]`), complaint drafts (feature 9).
6. Optional: integration tests against a local Supabase (`supabase start`) to cover real PostgREST behavior.

Dependencies: features 3, 5, and 9 need credentials. Feature 8 needs feature 6.

## L. Change log

### 2026-10-11 · Reports read and resolution API
- **Summary:** implemented `GET /api/reports` (filters by status and category, limit/offset pagination with `has_more`) and `PATCH /api/reports/[id]` (status update with consistent `resolved_at`, idempotent resolve, 404 for unknown ids). Added a server-only reports repository that validates every DB row against `reportSchema`, a `DatabaseError` mapped to 500 `DATABASE_ERROR`, a `validationError()` helper, Vitest, and 39 tests.
- **Contract changes (additive, no breaking changes for Aashish):**
  - `listReportsQuerySchema` gained `category`, `limit` (1–500, default 500), and `offset` (≥ 0, default 0).
  - `ListReportsResponse` gained `pagination: { limit, offset, has_more }`.
  - New exports: `reportIdSchema`, `MAX_REPORTS_PAGE_SIZE`, and the `Pagination` type.
  - The `Report` shape and the SQL schema are unchanged. Every column was audited against `reportSchema` and they match.
  - Migration note for the frontend: read `body.reports` as before, and optionally use `body.pagination`.
- **Files:**
  - Added: `src/app/api/reports/route.ts`, `src/app/api/reports/[id]/route.ts`, `src/lib/reports/repository.ts`, `vitest.config.mts`, `tests/api/reports.test.ts`, `tests/api/report-by-id.test.ts`, `tests/validation/reports.test.ts`, `tests/helpers/{fake-supabase,fixtures}.ts`, `tests/stubs/server-only.ts`.
  - Modified: `src/lib/validation/reports.ts`, `src/types/reports.ts`, `src/lib/api-error.ts`, `package.json` and `package-lock.json` (added `vitest`, bumped `@types/node` to ^24, added `test` and `test:watch` scripts, `check` now runs tests), `README.md`, `PROJECT_CONTEXT.md`.
- **Why:** first backend milestone. It unblocks the map (feature 6) and the resolve flow (feature 10).
- **Checks:** lint, typecheck, 39/39 tests, build, a mutation check, and curl smoke tests for the 503, 400, 405, and 500 paths (section J). No real-database test was run.
- **Remaining:** apply the migration and seed to Supabase and run the manual checks in section K item 1. The resolve UI is not built.

### 2026-10-11 · Project foundation
- **Summary:** initialized a Next.js 16.4 app in the empty repo (it had only `LICENSE`). Added the dependencies, shadcn/ui, shared Zod contracts and types, server-only env validation, the Supabase admin client, an API error helper, `/api/health`, the Supabase migration and seed, `.env.example`, README, and this file.
- **Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `components.json`, `.gitignore`, `.env.example`, `AGENTS.md`, `README.md`, `PROJECT_CONTEXT.md`, `src/app/{layout,page}.tsx`, `src/app/globals.css`, `src/app/api/health/route.ts`, `src/lib/{env,api-error,utils}.ts`, `src/lib/supabase/server.ts`, `src/lib/validation/{reports,api}.ts`, `src/types/reports.ts`, `src/components/ui/button.tsx`, `supabase/migrations/20261011000000_create_reports.sql`, `supabase/seed.sql`, `public/samples/sample-report.svg`.
- **Why:** establish a foundation and contracts so Tejas (backend) and Aashish (frontend) can work in parallel.
- **Checks:** lint, typecheck, build, health endpoint smoke test, and schema smoke test all passed (section J).
- **Remaining:** credentials, applying the migration, and all MVP features (section D).
