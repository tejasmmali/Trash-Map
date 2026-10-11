# Trash Map: Project Context

> The handoff document for every coding session, human or AI. Keep it accurate.
> Last updated: 2026-10-11 (square-cell heat map on the dashboard; report submission live; branch `feat/ai-classification`, based on `feat/reports-api`).

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
    api/classify/route.ts    POST: classify an uploaded image (implemented; saves nothing)
    api/complaints/          planned: draft a complaint
    layout.tsx               root layout, fonts, metadata
    page.tsx                 renders the reports dashboard
    globals.css              Tailwind + shadcn theme tokens
  components/
    ui/                      shadcn components (button.tsx so far)
    reports/reports-dashboard.tsx  client: header, data-source badge, demo banner, fetching, state
    reports/report-summary.tsx     summary count cards
    reports/report-filters.tsx     status/category selects + refresh
    reports/report-list.tsx        report cards with status buttons and OSM link
    reports/labels.ts              display labels and date formatting (Asia/Kolkata)
    map/report-map.tsx             client: heat-map section, mode toggle, legend; loads report-heat-map with next/dynamic (ssr: false)
    map/report-heat-map.tsx        client-only Leaflet map: light OSM tiles + square heat cells (canvas)
    map/map-placeholder.tsx        unused since the heat map landed; safe to delete
    classify/classify-panel.tsx    client: "Classify a photo" test panel (pick image, preview, POST /api/classify, show outcome)
  lib/
    validation/reports.ts    Zod schemas: the source of truth for shared contracts
    validation/api.ts        Zod schema for API error bodies
    env.ts                   server-only env validation (throws ConfigError)
    api-error.ts             server-only helpers for safe JSON error responses
    supabase/server.ts       server-only service-role Supabase client (lazy)
    reports/repository.ts    server-only data access for reports (queries, row validation, DatabaseError)
    reports-client.ts        browser-side API calls with response validation, counts, filtering, demo status rule
    heat-grid.ts             pure heat-map logic: report weights, square-cell grouping, colour ramp (no Leaflet)
    classify-client.ts       browser-side POST /api/classify with a pre-upload file check and response validation
    demo-reports.ts          6 typed demo reports used only when the API returns 503 CONFIG_MISSING
    ai/gemini.ts             server-only lazy GoogleGenAI client + configured model id
    ai/classify-image.ts     server-only prompt, model call, output validation, outcome mapping
    ai/errors.ts             server-only AiProviderError (with reason) and AiInvalidResponseError
    image-type.ts            detects JPEG/PNG/WebP from magic bytes (no dependencies)
    utils.ts                 shadcn `cn()` helper
  types/reports.ts           TypeScript types inferred from the Zod schemas
supabase/
  migrations/20261011083327_create_reports.sql   (applied to project trash-map)
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
- Every module that reads secrets starts with `import "server-only"` (`env.ts`, `api-error.ts`, `supabase/server.ts`, `reports/repository.ts`, `ai/*.ts`). Importing one from a Client Component fails the build.
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
| `GET /api/reports` (list, filters, pagination) | **Tested (live)** | Unit tests with a fake client, plus live checks against `trash-map`: counts, filters, combined filters, pagination, and ordering. |
| `PATCH /api/reports/[id]` (status + `resolved_at`) | **Tested (live)** | Live: resolve sets `resolved_at`, re-resolve keeps it (the `.neq().maybeSingle()` path works on real PostgREST), other statuses clear it, unknown UUID gives 404 on both paths. |
| Supabase migration (`reports` table, `report-images` bucket) | **Applied** | Applied to project `trash-map` on 2026-10-11 and verified by catalog queries (section F). |
| Seed data (25 sample reports) | **Applied** | 25 rows in `trash-map` (17 pending, 4 in progress, 4 resolved), all `is_sample` and `[SAMPLE]`. |
| App ↔ Supabase connection | **Tested (live)** | Legacy `service_role` key for `trash-map` in `.env.local`. 22 live API checks passed on 2026-10-11 (section J); the dashboard shows "Live data" with 25 reports. |
| 1. Photo upload | Backend **Tested (live)**; UI not started | `POST /api/reports` accepts the photo, validates it, and stores it in `report-images`. No submission form yet. |
| 2. Location selection / geolocation | Not started | |
| 3. Gemma classification (`POST /api/classify`) | **Tested (live)** | 49 mocked unit tests, plus 5 real classifications with `gemma-4-26b-a4b-it` on 2026-10-11 that returned the expected outcomes (section J). Also runs server-side inside `POST /api/reports`. |
| Classify test panel (UI) | Tested | "Classify a photo" panel on the dashboard, between the summary and the map. Unit tests for `classify-client.ts`; verified in a browser against the live model (section J). |
| 4. Classification schema validation | **Tested (live)** | All 5 real model outputs passed Zod validation and mapped to valid `ClassifyResponse` shapes. |
| 5. Save report + image to Supabase (`POST /api/reports`) | **Tested (live)** | 32 mocked route tests, plus a live run on 2026-10-11: a garbage photo gave 201 with the row and image in Supabase, and a clean-street photo gave 422 with nothing stored (section J). |
| Reports dashboard UI (summary, filters, list, status buttons, demo mode) | Tested (no real DB) | Verified in a browser in demo mode, and in live mode against a throwaway fake PostgREST server (section J). Client logic is unit tested. |
| 6. Map with reports | Implemented (as heat cells) | Leaflet map on the dashboard. Reports appear as square heat cells with a hover tooltip ("3 reports"); there are no individual markers or popups yet. Verified in a browser with the 25 live reports (section J). |
| 7. Density heat map | **Tested** | "All reports" mode. Unit tests for the grouping and colours, plus a browser check. |
| 8. Delay-weighted heat for unresolved reports | **Tested** | "Unresolved" mode, using the formula in section H (now implemented). Unit tests, plus a browser check. |
| 9. Complaint drafts | Not started | Contract defined. |
| 10. Mark as resolved | Implemented | Backend `PATCH /api/reports/[id]` plus per-card status buttons in the dashboard. Verified live against `trash-map` through the API. |
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
| `POST /api/reports` | **Implemented** | `multipart/form-data`: `image` (File), `latitude`, `longitude`, optional `description` (`createReportFieldsSchema` + `imageFileSchema`), see below | `201 { report: Report }` (`CreateReportResponse`) |
| `POST /api/classify` | **Implemented** | `multipart/form-data`: `image` (File) | `200 ClassifyResponse`, see below |
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

**`POST /api/classify`** (`classifyResponseSchema`, type `ClassifyResponse`)
- A preview endpoint. It **never saves the image or creates a report.**
- Request: `multipart/form-data` with one field, `image`: JPEG, PNG, or WebP, 1 byte to 4 MB. Example: `curl -F image=@photo.jpg http://localhost:3000/api/classify`.
- Input checks, in order:
  1. The content type must be multipart (otherwise 415).
  2. A `Content-Length` header is required (otherwise 411).
  3. A body larger than 4 MB + 64 KB is rejected with 413 before it is read.
  4. A malformed multipart body returns 400.
  5. A file over 4 MB returns 413.
  6. A missing image, or a declared type outside JPEG/PNG/WebP, returns 400.
  7. The file's magic bytes must be a real JPEG/PNG/WebP **and** match the declared type (otherwise 400). This stops renamed or spoofed files.
- Success is always 200 with one of four shapes, discriminated by `outcome`:

  | `outcome` | Meaning | Body |
  | --- | --- | --- |
  | `garbage` | Garbage with a known category | `{ outcome, classification: ClassificationResult }` with `is_garbage: true` |
  | `unclear_category` | Garbage, but the type can't be told | `{ outcome, confidence, description }` |
  | `not_garbage` | The photo doesn't show garbage | `{ outcome, confidence, description }` |
  | `uncertain` | The model can't decide, **or** its confidence was below 0.5 (`MIN_CONFIDENCE`) | `{ outcome, confidence, description }` |

  Example: `{ "outcome": "garbage", "classification": { "is_garbage": true, "category": "plastic", "confidence": 0.86, "description": "Plastic bags and bottles piled beside a road.", "severity": "medium" } }`.
- How the model is called (`src/lib/ai/classify-image.ts`):
  - The model is whatever `GEMINI_MODEL` names, with no fallback.
  - The prompt goes in the user message, because some Gemma models don't support system instructions. Settings are temperature 0.1, 512 output tokens and a 30 s timeout.
  - The first attempt asks for JSON output with a schema. If the API rejects JSON mode for that model, the call is retried once without it, and the model is remembered for the life of the process.
  - The model returns `{ verdict, category, severity, confidence, description }`, which is validated with Zod. A garbage verdict must name a category (or `"unclear"`), and a known category needs a severity.
  - Text around the JSON, such as a Markdown fence, is tolerated. Anything else is rejected as an invalid response.
- Classification-specific errors (all use the standard error body; nothing from the provider is passed through):

  | Situation | Status | Code and message |
  | --- | --- | --- |
  | Not multipart | 415 | `VALIDATION_ERROR` |
  | No `Content-Length` | 411 | `VALIDATION_ERROR` |
  | Image too large | 413 | `VALIDATION_ERROR` "Image must be 4 MB or smaller" |
  | Bad, missing, or spoofed image | 400 | `VALIDATION_ERROR` |
  | `GEMINI_API_KEY` or `GEMINI_MODEL` missing | 503 | `CONFIG_MISSING` with `details.missing`. The model is not called |
  | Model can't read images | 502 | `AI_UNAVAILABLE` "The configured AI model cannot read images. Set GEMINI_MODEL to an image-capable model." |
  | Model id not found | 502 | `AI_UNAVAILABLE` "…was not found. Check GEMINI_MODEL." |
  | Key rejected | 502 | `AI_UNAVAILABLE` "The AI provider rejected the server's credentials." |
  | Provider rate limit (429) | 503 | `AI_UNAVAILABLE` "The AI service is busy. Try again shortly." |
  | Timeout (30 s) | 504 | `AI_UNAVAILABLE` |
  | Other provider or network failure | 502 | `AI_UNAVAILABLE` |
  | Empty, non-JSON, or schema-violating model output | 502 | `AI_INVALID_RESPONSE` "The AI returned an unusable result. Try again or use a different photo." |

- Contract note: `ClassificationResult` is unchanged. `ClassifyResponse` was previously planned as `{ classification }`; it is now the union above, so the UI must switch on `outcome`. No UI code used it yet.

**`POST /api/reports`** (create a report; `src/lib/reports/submit-report.ts`, type `CreateReportResponse`)
- Request: `multipart/form-data` with `image` (same rules and checks 1–7 as `/api/classify`, via the shared `src/lib/image-upload.ts`), `latitude` (−90 to 90), `longitude` (−180 to 180), and an optional `description` (≤ 1000 chars, trimmed). Example: `curl -F image=@photo.jpg -F latitude=19.0178 -F longitude=72.8478 -F "description=Near the bus stop" http://localhost:3000/api/reports`.
- Coordinates must be plain decimal strings. Missing, empty, hex (`0x10`), or `Infinity` values are rejected with 400. (They used to be coerced, so a missing value became 0.)
- **Every other field is ignored.** The server sets `id`, `image_url`, `category`, `confidence`, `ai_analysis`, `status` (`pending`), `resolved_at` (`null`), and `is_sample` (`false`). Client-sent values for these, or a client-side classification, have no effect.
- Steps, in order:
  1. Validate the image, then the fields. Nothing below runs if either fails.
  2. Check that both the Supabase and the Gemini config are present. If not, return 503 `CONFIG_MISSING` listing every missing name, before the model is called.
  3. Classify the image on the server with `classifyImage()`, the same function `/api/classify` uses.
  4. Decide by outcome:

     | Outcome | Result |
     | --- | --- |
     | `garbage` | Saved. `category`, `confidence`, and `ai_analysis` (the full `ClassificationResult`) come from the model |
     | `unclear_category` | Saved with `category: "other"`, the model's `confidence`, and `ai_analysis: null` (see section H) |
     | `not_garbage` | 422 `VALIDATION_ERROR` "This photo doesn't appear to show garbage…", `details: { outcome }`. Nothing uploaded or saved |
     | `uncertain` | 422 `VALIDATION_ERROR` "We couldn't tell what this photo shows. Upload a clearer, well-lit photo…", `details: { outcome }`. Nothing uploaded or saved |

  5. Generate a UUID with `crypto.randomUUID()`. It is both the report id and the object key `reports/<uuid>.<ext>`, where the extension comes from the **detected** type (`jpg`, `png`, `webp`). The original filename is never used.
  6. Upload to `SUPABASE_STORAGE_BUCKET` with `upsert: false` and the detected content type, then take the public URL as `image_url`.
  7. Insert the row and validate it with `reportSchema`.
- `description`: the user's text if given, otherwise the model's description.
- Failures (standard error body; no provider, storage, or database messages are passed through):

  | Situation | Status | What happens |
  | --- | --- | --- |
  | Image or field validation | 400 / 411 / 413 / 415 | Nothing classified, uploaded, or saved |
  | Config missing | 503 `CONFIG_MISSING` | Nothing classified, uploaded, or saved |
  | AI failure | Same as `/api/classify` (502 / 503 / 504) | Nothing uploaded or saved. An AI failure is never treated as a classification |
  | Upload fails | 500 `STORAGE_ERROR` "Image upload failed" | No row is inserted |
  | Insert fails | 500 `DATABASE_ERROR` | The uploaded object is removed (best effort). If removal fails too, the error is logged server-side and the client still gets the same safe 500 |
  | Inserted row fails `reportSchema` | 500 `DATABASE_ERROR` | The image is **kept**, because the row exists and points at it |

- No automatic retries anywhere in this flow, so a request creates at most one object and one row.

**How the dashboard uses the API** (all calls go through `src/lib/reports-client.ts`):
- `fetchReports(filters, offset)` calls `GET /api/reports` with `status`, `category`, and `offset` when set. It always uses the server's default `limit` (500).
  - It validates the whole response with `reportSchema`. Any shape mismatch is treated as an error.
  - It returns one of three results: `ok` (reports + pagination), `config-missing` (only for a **503 whose body code is `CONFIG_MISSING`**), or `error` (with a readable message).
- Changing a filter or pressing Refresh reloads from offset 0. "Load more" appears when `has_more` is true. It requests `offset = loaded count` and drops duplicate ids.
- `updateReportStatus(id, status)` sends `PATCH /api/reports/[id]` with `{ status }`. On success the card is replaced with the report the server returned, so `resolved_at` always comes from the server.
  - On failure the card shows the error message. 404 is shown as "This report no longer exists."
  - Buttons on that card are disabled while its request is in flight. A ref-based guard also blocks duplicate submits.
- After a status change, reports that no longer match the active filters disappear from the list, in both live and demo mode.
- Summary counts are computed from the loaded and filtered reports only, and the note under them says so.

**Demo mode** (`src/lib/demo-reports.ts`):
- Entered only when `GET /api/reports` returns 503 `CONFIG_MISSING`. Database errors, network errors, and malformed responses show an error state instead, never demo data.
- Shows 6 built-in reports marked `is_sample: true` with `[SAMPLE]` descriptions. The header badge reads "Demo data, not saved", and a banner explains they are not real submissions.
- Filters apply on the client. Status changes update only in-memory state, using `applyDemoStatus`, which mirrors the server's rules: resolving sets `resolved_at` to the browser's current time, re-resolving keeps the original, and other statuses clear it. Nothing is persisted, and a page reload resets the data.
- Limitation: every filter change or refresh still calls the API first. Each call returns 503 quickly, then the dashboard re-enters demo mode with the local demo state preserved.

Errors (every non-2xx response): `{ error: { code, message, details? } }`, where `code` is one of `VALIDATION_ERROR` (400; also 411, 413, 415 on the upload endpoints, and 422 for a rejected photo on `POST /api/reports`), `NOT_FOUND` (404), `CONFIG_MISSING` (503, `details.missing` lists env var **names**), `AI_UNAVAILABLE` (502, 503, or 504), `AI_INVALID_RESPONSE` (502), `STORAGE_ERROR` (500), `DATABASE_ERROR` (500), `INTERNAL_ERROR` (500). Never include secrets or stack traces. Use `apiError()`, `validationError()`, and `handleUnknownError()` from `src/lib/api-error.ts`.

## F. Database and storage

**Supabase project:** `trash-map`, ref `olohsrjldukoatxxptds`, region `ap-south-1` (Mumbai), Free plan, org "tejasmmali's Org". Created 2026-10-11 through the Supabase connector, at Tejas's request. URL: `https://olohsrjldukoatxxptds.supabase.co`. The org's other six projects belong to other apps and were not touched.

**Migration `supabase/migrations/20261011083327_create_reports.sql`: applied 2026-10-11** to the empty database with the connector's `apply_migration`. The remote history records version `20261011083327` with name `create_reports`. The repo file was renamed from `20261011000000_…` to match, so `supabase db push` won't try to re-apply it. Its contents are unchanged.

Verified afterwards with catalog queries (`information_schema`, `pg_constraint`, `pg_indexes`, `pg_policies`, `storage.buckets`):
- 12 columns with types and nullability matching `reportSchema`: `uuid`, `text`, `float8` ×2, `report_category`, `text?`, `float4?`, `report_status`, `timestamptz`, `timestamptz?`, `jsonb?`, `bool`.
- Enum values match the Zod enums exactly.
- Check constraints for latitude, longitude, confidence 0–1, description ≤ 1000, and `resolved_at_matches_status` are present.
- The primary key and `reports_status_created_at_idx` exist. RLS is on with 0 policies. The bucket matches the definition below, with 0 storage policies.

Security advisor: one INFO, "RLS enabled, no policy", which is intentional. Performance advisor: one INFO, "unused index", expected on a new table.

**Seed: applied 2026-10-11.** It ran once against the empty table (0 rows beforehand). The result is 25 rows: 17 pending, 4 in progress, 4 resolved, all `is_sample = true` with a `[SAMPLE]` prefix. Re-running is safe; it replaces only sample rows.

Schema details:
- Enums `report_category`, `report_status` (same values as the Zod enums).
- Table `public.reports`: the columns in section E. `description`, `confidence`, `resolved_at`, and `ai_analysis` are nullable. Check constraints cover lat/lng range, confidence 0–1, description length, and `(status = 'resolved') = (resolved_at is not null)`.
- Index `(status, created_at desc)` for the "unresolved, oldest first" heat-map query.
- RLS is **enabled with no policies**, so anon and authenticated keys can't read or write. Only the service role, used server-side, can.
- Storage bucket `report-images`: **public read**, 4 MB limit, jpeg/png/webp. Object key: `reports/<report-uuid>.<ext>`, where the UUID is the report id and the extension comes from the detected image type. Uploads happen server-side only, through `POST /api/reports` (`src/lib/reports/storage.ts`), with `upsert: false`.
  - Why public: the contract says `Report.image_url` is a directly renderable public URL. Every report, including its photo, is already shown to anyone through `GET /api/reports` with no login, so a private bucket with signed URLs would add a contract change without hiding anything.
  - Implications:
    - Anyone with an object URL can view the image.
    - Photos may show faces or number plates.
    - Deleting a report must also delete its object.
    - Listing the bucket is **not** possible without a storage SELECT policy, and there are none.
  - If photos need to become private later, switch the bucket to private, store the object path, and have the API return short-lived signed URLs. That changes `image_url` semantics, so coordinate it with Aashish.
  - Status: live upload, public read, and removal verified on 2026-10-11 (section J). The bucket's settings were not changed.

`supabase/seed.sql`: 25 rows across Mumbai with `is_sample = true` and descriptions prefixed `[SAMPLE]`. It has a mix of statuses and ages from 1 to 30 days. Re-runnable, because it deletes only `is_sample` rows first.

No relationships or other tables. Complaint drafts are generated on demand and not stored (decision in section H).

## G. Environment setup

Variables (see `.env.example`; real values go in `.env.local`, which git ignores):

| Variable | Scope | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public, also read server-side | DB + storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Reserved; unused in the MVP |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | DB + storage. Must be a secret key (`sb_secret_…`) or the legacy `service_role` JWT. Publishable (`sb_publishable_…`) and `anon` JWT keys are rejected as `CONFIG_MISSING`, because RLS would make them read zero rows |
| `SUPABASE_STORAGE_BUCKET` | server | Defaults to `report-images` |
| `GEMINI_API_KEY` | **server only** | Classification, complaint drafts |
| `GEMINI_MODEL` | server | Gemma model id **with image input**; no default on purpose. If the model can't read images, `/api/classify` returns 502 instead of switching models |

`getSupabaseEnv()` and `getGeminiEnv()` in `src/lib/env.ts` validate these lazily and throw `ConfigError` listing only variable **names**. Nothing calls external services at build time.

Scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`next typegen && tsc --noEmit`), `test` (`vitest run`), `test:watch`, `check` (lint + typecheck + test). Requires Node ≥ 20.9; developed on Node 24.19 and npm 11.17.

Local Supabase configuration (Tejas's machine, 2026-10-11): `.env.local` (git-ignored) has `NEXT_PUBLIC_SUPABASE_URL` (the trash-map URL), `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET=report-images`.
- The key is the legacy `service_role` JWT for ref `olohsrjldukoatxxptds`, checked by decoding its role and ref without printing it. `/api/health` reports `supabase: true`.
- Other machines or deployments need the key from the Dashboard: trash-map → Project Settings → API Keys → **Secret keys** (`sb_secret_…`) or Legacy API keys → **service_role**. Never use the publishable or anon key.

Configuration gaps: none for local development.

Local Gemini configuration (Tejas's machine, 2026-10-11): `.env.local` (git-ignored, never committed) holds a valid `GEMINI_API_KEY` and `GEMINI_MODEL=gemma-4-26b-a4b-it`. `/api/health` reports `gemini: true`. Any other machine or deployment needs its own key in its own env.
- Model choice: Google's "Run Gemma with the Gemini API" page (ai.google.dev/gemma/docs/core/gemma_on_gemini_api, checked 2026-10-11) lists exactly two Gemma models on the Gemini API, `gemma-4-26b-a4b-it` and `gemma-4-31b-it`. Both take text and image input. `26b-a4b` is a mixture-of-experts model (about 4B active parameters), so it should be faster.
- Verified with the real key:
  - The models endpoint returned 200 for both ids, with `generateContent` supported.
  - `gemma-4-26b-a4b-it` accepts **inline** base64 images, which is what our code sends (Google's docs example uses the Files API instead).
  - It accepts JSON mode (`responseMimeType` + `responseJsonSchema`), so the prompt-only fallback is not needed for this model.
  - `gemma-4-31b-it` was not tried for classification.
- No model default was added to the code. The id lives only in env.

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
| Demo mode only on 503 `CONFIG_MISSING`, never on other failures | Mock data must never hide a real outage or be mistaken for real submissions | Falling back to demo data on any error |
| Demo status changes compute `resolved_at` in the browser | There is no server in demo mode. This is the only place the browser sets it, and live mode always uses the server's value | Leaving `resolved_at` null for demo resolves (would break the status/`resolved_at` rule) |
| Native `<select>` elements for filters instead of a shadcn Select | Accessible, no new dependency, and easy for Aashish to swap later | Adding shadcn `select` now |
| UI loads data in a client component after mount; `page.tsx` stays a server component | The page needs browser state such as filters and in-flight updates. The static shell still prerenders | Server-side fetch in `page.tsx` (would need request-time rendering and duplicate logic) |
| `/api/classify` returns 200 with four `outcome` values instead of a 4xx for non-garbage | "Not garbage" and "uncertain" are valid answers, not client errors, and the UI needs a different message for each | 422 for non-garbage; a single `{ classification }` shape (forces a fake category) |
| Confidence below 0.5 becomes `uncertain` | Avoids presenting a weak guess as a classification | Trusting any confidence |
| Image type is checked from magic bytes, not just the declared type | Clients control the declared MIME type | Trusting `File.type`; adding a file-type dependency |
| Large bodies are rejected from `Content-Length` before `formData()` | Avoids buffering oversized uploads in memory | Reading first, then checking size |
| Try JSON mode first, then fall back to prompt-only JSON, cached per model | Structured output is more reliable, but some Gemma models may not support it | JSON mode only (could fail outright); prompt only (less reliable) |
| Unsupported image input is detected from the provider's 400 message | The SDK has no way to ask a model's capabilities | Hard-coded allowlist of models (goes stale) |
| Route tests mock `getSupabaseAdmin` with a fake query builder | No DB is available. Tests cover our logic, not PostgREST | Local Supabase via Docker (heavier; still worth adding later) |
| `POST /api/reports` saves `garbage` and `unclear_category` (as `other`), and rejects `not_garbage` and `uncertain` with 422 | A known pile of unclear type is still worth mapping. A photo that isn't garbage, or can't be read, shouldn't become a report. 422 (not 200) because no report was created | Saving everything; rejecting `unclear_category` |
| `unclear_category` reports store `ai_analysis: null` | `ai_analysis` must be a full `ClassificationResult` per the contract, and that requires a real `category` and `severity`, which the model didn't give. Storing a made-up one would misrepresent the AI, and storing a partial object would make `GET /api/reports` fail validation for every row | Extending the `Report` contract (not needed for the MVP; can be done later with Aashish) |
| Upload first, then insert, and remove the object if the insert fails | `image_url` must exist before the row is written, and the column is not nullable | Insert, then upload and update (leaves rows without images on failure) |
| The image is kept if the inserted row fails `reportSchema` | The row exists and references it; deleting it would leave a row with a broken image | Always removing on any failure |
| The user's description wins over the model's | The user knows the place; the model's text is the fallback so the field is rarely empty. The model's description stays in `ai_analysis` for `garbage` | Always storing the model's description |
| Config is checked for both Gemini and Supabase before classifying | Avoids spending a model call when the result can't be saved | Checking lazily on first use |

**Delay-weighted heat (implemented in `src/lib/heat-grid.ts`):** for unresolved reports (`pending` and `in_progress`), `weight = min(1, 0.2 + days_open / 14)`, so a new report starts at 0.2 and reaches full intensity after about 11 days open. Resolved reports weigh 0 in that mode. The density mode uses weight 1 for every report. Days are measured from `created_at` to the browser's current time.

**Heat map design** (2026-10-11):
- **Square cells, not `leaflet.heat`.** `leaflet.heat` only draws blurred radial blobs, so it can't produce square cells. Each cell is an `L.rectangle` drawn on one shared canvas renderer, which is cheap at the 500-report page size. `leaflet.heat` and `@types/leaflet.heat` are now unused dependencies.
- **Cells are a fixed 14 px on screen**, with a 1 px gap. They're regrouped in projected pixel space on every zoom, so zooming in splits a hot cell into its parts.
- **Colour:** a cell's weight sum divided by `max(hottest cell, 3)`, mapped light pink → pink → red → yellow (`HEAT_STOPS`). The floor of 3 stops a lone report from showing as a maximum hotspot.
- **Base map:** standard OpenStreetMap tiles in grayscale, brightened and at 0.55 opacity over the white page background, matching the app's light theme. No API key and no new dependency. Opacity must use Leaflet's `opacity` option, because Leaflet writes an inline `opacity` that overrides CSS classes.
- **Data:** the map uses the same `reports` array as the list, so it follows the status and category filters and only covers loaded reports. It fits the map to the reports once on first load and doesn't jump on later filter changes. Scroll-wheel zoom is off so the page scrolls normally; use the +/- buttons, double-click, or pinch.

Assumptions:
- Mumbai only. The map defaults to center about `19.076, 72.8777`, zoom 11.
- English-only UI and complaint drafts for the MVP.
- Anyone can mark a report resolved (no auth).

Open questions:
- Should complaint drafts target a specific BMC ward, or stay generic?
- ~~What should `POST /api/reports` do for each classification outcome?~~ Decided 2026-10-11 as proposed (see the decision table above).

## I. File ownership and integration boundaries

| Area | Owner | Notes |
| --- | --- | --- |
| `src/app/api/**`, `src/lib/env.ts`, `src/lib/api-error.ts`, `src/lib/supabase/**`, `src/lib/ai/**`, `src/lib/reports/**`, `src/lib/image-upload.ts`, `src/lib/image-type.ts` | Tejas | Server-only (`image-type.ts` has no secrets and could be reused client-side) |
| `supabase/**` | Tejas | Schema changes need a new migration file, never edits to an applied one |
| `src/components/**` (except `ui/` generation), `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `public/**` | Aashish | Includes the dashboard scaffold Tejas built. Restyle or restructure freely |
| `src/components/ui/**` | Aashish | Add components with `npx shadcn@latest add <name>` |
| `src/lib/reports-client.ts` | **Shared** (Tejas owns API behavior) | Aashish may add UI helpers. Changes to the request or response handling need Tejas |
| `src/lib/demo-reports.ts` | **Shared** | Demo-only data. Delete it, and the demo branch in `reports-dashboard.tsx`, once Supabase is live if it's no longer wanted |
| `src/lib/validation/**`, `src/types/**` | **Shared** | Tejas edits; any change must be announced and logged in section L |
| `PROJECT_CONTEXT.md`, `README.md`, `package.json` | Shared, coordinated by Tejas | |

Integration rules:
- Frontend calls the HTTP API in section E through `src/lib/reports-client.ts` and types data with `@/types/reports`. Mock data lives only in `src/lib/demo-reports.ts`, and only appears in the explicitly labeled demo mode. Don't add other fixtures to production code.
- Client Components must never import anything with `import "server-only"`.
- Work on feature branches and open small PRs into `main`.

## J. Testing and known issues

**Square-cell heat map verification (2026-10-11):**
- `npm run check` passed: lint, typecheck, Vitest **166/166** across 9 files. `tests/lib/heat-grid.test.ts` has 10 tests: density and delay weights (new, 7 days, capped, resolved, future timestamps), cell grouping and boundaries including negative coordinates, zero-weight skipping, the scale floor, and the colour stops with clamping.
- `npm run build` passed, and `/` is still statically prerendered.
- Browser check on `next dev` with live Supabase data (25 sample reports): the map loaded with grayscale tiles on white and pink cells across Mumbai, plus one hotter cell where reports overlap near Dadar. Zooming in regrouped the cells. "Unresolved" hid resolved reports and recoloured by days open. The computed tile style was `brightness(1.12) contrast(0.7) grayscale(1)` at opacity 0.55.
- Not checked: mobile layout and touch gestures, demo mode visually (it uses the same `reports` array), and behaviour with hundreds of reports in one area.

**`POST /api/reports` verification (2026-10-11, branch `feat/ai-classification`): succeeded.**
- `npm run check` passed: lint clean, typecheck clean, Vitest **156/156** across 8 files. `npm run build` passed, and `/api/reports` is dynamic.
- `tests/api/create-report.test.ts` (32 tests, with Gemini, Storage, and the database all mocked; no credentials or paid calls):
  - `garbage` gives 201 with a `reportSchema`-valid report. The upload uses `reports/<uuid>.jpg` with `upsert: false`, the id matches the path, and the insert has exactly the server-controlled fields (`pending`, `resolved_at: null`, `is_sample: false`).
  - Spoofed `category`, `status`, `is_sample`, and `image_url` form fields are ignored. A `../../etc/passwd.jpg` filename never reaches the path.
  - The user's description wins, a blank one falls back to the model's, and PNG gets `.png` with `image/png`.
  - `unclear_category` is saved as `other` with `ai_analysis: null`.
  - `not_garbage` and `uncertain` give 422 with no upload and no query.
  - Missing, GIF, spoofed, over-4 MB, oversized-by-`Content-Length` (body never read), non-multipart, and malformed images are rejected with no classification and no Supabase client created.
  - Ten invalid field cases (missing, empty, out-of-range, non-numeric, hex, and infinite coordinates; a long description; a description sent as a file) give 400.
  - Missing config gives 503 listing both missing names, with no model call.
  - Three AI failure types give their usual codes, with no upload or insert.
  - An upload failure gives 500 `STORAGE_ERROR` with no insert.
  - An insert failure removes the uploaded object. If removal returns an error or throws, the response is still the same safe 500 (no hosts or keys in the body), and the failure is logged server-side.
  - A contract-breaking inserted row gives 500, and the image is not removed.
- Mutation checks: removing the cleanup call failed 3 tests, `upsert: true` failed 2, and accepting every outcome failed 2. All passed again after restoring.
- `tests/validation/reports.test.ts`: 5 new cases confirm coordinates are no longer coerced (missing, empty, hex, infinite, or a non-string).
- **Live run** against `next dev` with the real `trash-map` project and `gemma-4-26b-a4b-it`, using two deliberate requests:
  - Baseline by SQL: 25 rows, all samples (17 pending, 4 in progress, 4 resolved), 0 objects in `report-images`. A fingerprint (md5 over id, status, `resolved_at`, and description) of the sample rows was recorded.
  - `clean-street.jpg` gave **422** `not_garbage` in 3.3 s.
  - `garbage.jpg` with Dadar coordinates (19.0178, 72.8478), plus spoofed `category=organic`, `status=resolved`, and `is_sample=true` fields, gave **201** in 4.0 s. The report was `mixed`, confidence 0.9, `pending`, `resolved_at: null`, `is_sample: false`, `ai_analysis` filled in, and the user's description kept.
  - The `image_url` returned 200 `image/jpeg`, and its bytes were identical to the uploaded file.
  - `GET /api/reports` returned 26 reports with the new one first.
  - SQL afterwards showed exactly one new row and one object (`reports/<id>.jpg`, `image/jpeg`, 202,652 bytes), so the rejected photo created nothing. The sample counts and fingerprint were unchanged.
  - **Cleanup:** the test row (matched on its id and `is_sample = false`) and its object were deleted with the service-role client. SQL then showed 25 rows, 0 non-sample rows, 0 objects, and the same sample fingerprint.
- Not exercised live: `unclear_category` (the model hasn't produced it), the insert-failure cleanup path, and storage failures. These are covered by mocked tests only.

**Live Supabase verification (2026-10-11): succeeded.** Run against `next dev` with the real `service_role` key and project `trash-map`, using an ad-hoc script (`/tmp/tm-live-db.mjs`, not committed). All **22 checks passed**:
- Reads:
  - `GET /api/reports` returned 25 rows with `has_more: false`, all `is_sample` and `[SAMPLE]`, ordered newest first.
  - `status=resolved` returned 4, all with `resolved_at`. `status=pending` returned 17, all with `resolved_at: null`. `category=construction` returned 4. `status=pending&category=plastic` returned 5, all matching.
  - `limit=10` gave `has_more: true`. `limit=10&offset=20` returned 5 with `has_more: false`. The three pages covered all 25 ids with no overlap. `limit=0` gave 400.
- Writes, on one sample row only: `3f275c1b-7c05-4800-ae45-0a14be8b22e5` ("[SAMPLE] Garden waste on a Chembur street corner", originally pending).
  - PATCH `resolved` set `resolved_at` to `2026-10-11T09:07:30.183+00:00`. A second PATCH `resolved` 1.5 s later returned the **same** `resolved_at`.
  - PATCH `in_progress` cleared `resolved_at`. PATCH `pending` restored the original state, and all other fields were unchanged.
  - An unknown UUID gave 404 `NOT_FOUND` on both the resolve and non-resolve paths. An invalid id and an invalid status each gave 400.
- Confirmed independently by SQL through the connector afterwards: 17 pending, 4 in progress, 4 resolved; the test row is `pending` with `resolved_at` null; 0 non-sample rows.
- Error safety: `next start` with `NEXT_PUBLIC_SUPABASE_URL` overridden to a non-existent host returned 500 `DATABASE_ERROR` "Database request failed" for GET (after about 7.1 s of supabase-js retries) and for PATCH. The body contained neither the key, the host, nor a stack trace. The server logged `DatabaseError: Failed to list reports` and `Failed to resolve report`.
- Dashboard (`next dev`, page snapshot): "Data source: Live data", "Counts cover the 25 loaded reports", with the 25 Supabase rows listed.
- Storage uploads were later verified through `POST /api/reports` (see above).

Supabase setup (2026-10-11, branch `feat/ai-classification`):
- **Done through the Supabase connector:**
  - Listed projects (6 existing, all paused, none for Trash Map).
  - Created `trash-map` after the cost check ($0/month on the Free plan) and Tejas's choice.
  - Confirmed the database was empty, applied the migration, and verified the schema with catalog queries (section F).
  - Ran the security and performance advisors.
  - Ran the seed once, giving 25 sample rows.
- **Not done:** any request through the app's API against the real database. `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` holds a publishable key (checked by prefix, without printing it). No mutation checks ran, and no rows were changed after seeding.
- Observed with that wrong key, before the env check was added: `/api/health` said `supabase: true` and `GET /api/reports` returned 200 with `reports: []` (RLS hides every row from a publishable key). That would have shown an empty "Live data" dashboard instead of demo mode.
- Fix: `getSupabaseEnv()` now rejects publishable keys and legacy `anon` JWTs. Afterwards the same server returned `supabase: false` and 503 `CONFIG_MISSING` (`missing: ["SUPABASE_SERVICE_ROLE_KEY"]`). Six new tests are in `tests/lib/env.test.ts`, using made-up keys.
- `npm run check` passed: lint clean, typecheck clean, Vitest **119/119** across 7 files. `npm run build` passed.

Verification for the classify test panel (2026-10-11, branch `feat/ai-classification`):
- `npm run check` passed: lint clean, typecheck clean, Vitest **113/113** across 6 files. The 9 new tests in `tests/lib/classify-client.test.ts` cover the file pre-check, the multipart request, success and non-garbage outcomes, API error messages, non-API errors, malformed bodies, and network failure (fetch mocked).
- `npm run build` passed. `/` is still static.
- Browser check with `next dev` and the live model:
  - The panel rendered with Classify disabled until a photo was chosen.
  - Choosing a photo showed a preview and enabled the button. Clicking it showed "Classifying…" and a loading message.
  - A landfill photo chosen by Tejas returned "Garbage detected", Mixed, High, 95%, with a description.
- No automated component (React) tests.

**Live Gemini verification (2026-10-11, branch `feat/ai-classification`): succeeded.** `next start` with the real key from `.env.local`, `GEMINI_MODEL=gemma-4-26b-a4b-it`, and one `curl -F image=@… /api/classify` per photo.
- Test photos: openly licensed images from Wikimedia Commons, downloaded at 1280 px wide to `~/trash-map-test/` (outside the repo, not committed). Licenses and authors are in `~/trash-map-test/SOURCES.txt`. Each was checked by eye before testing.

  | Photo (source) | What it shows | Actual response | Time |
  | --- | --- | --- | --- |
  | `garbage.jpg` ("Cattle feeding at rubbish dump outside Byculla station(east)", CC0) | Night-time roadside dump in Mumbai with what look like onion skins and plastic; cows feeding | 200 `garbage`: category `mixed`, severity `medium`, confidence 0.9, "There is a pile of organic waste and scattered plastic litter on the ground near the animals." | 6.0 s |
  | `clean-street.jpg` ("Palm Beach Road, Belapur, Navi Mumbai", CC BY-SA 3.0) | Clean multi-lane road, no visible litter | 200 `not_garbage`: confidence 1, "A wide, clean asphalt road with vehicles and tall buildings in the background under a hazy sky." | 4.9 s |
  | `construction-debris.jpg` ("Marine Drive Mumbai", CC BY-SA 4.0) | Marine Drive skyline at night; foreground is a large pile of rubble, wood, drums, and sacks | 200 `garbage`: category `mixed`, severity `high`, confidence 0.95, "A large pile of mixed debris, including construction rubble, wood, and various discarded items…" | 5.9 s |
  | `ambiguous-blurred-garbage.jpg` (made locally from `garbage.jpg` by shrinking it to 40 px and back up with `sips`) | Unrecognizable dark blur | 200 `uncertain`: confidence 0.3, "The image is extremely dark and blurry, making it impossible to identify any objects…" | 4.1 s |
  | `crowd-motion-blur.jpg` ("BlurryUnderground", CC0) | Motion-blurred crowd in a London station, no litter | 200 `not_garbage`: confidence 1, "…busy train station concourse with many people… No garbage or litter is visible." | 4.9 s |

- All five responses matched the `ClassifyResponse` union. The server's `classifyResponseSchema.parse` would have returned 502 otherwise. The outcomes `garbage`, `not_garbage`, and `uncertain` were seen live; `unclear_category` was not triggered by any photo and is covered only by mocked tests.
- Observation: the construction-debris pile was labelled `mixed`, not `construction`. That's defensible, since it contains drums and sacks too, but the prompt may need a clearer rule if construction waste should take priority.
- Error paths with the live config:
  - GIF, an HTML file named `.png`, a real JPEG declared as PNG, a 4.3 MB file, and a JSON body returned 400, 400, 400, 413, and 415. None reached the provider.
  - Overriding `GEMINI_MODEL=gemma-does-not-exist` returned 502 `AI_UNAVAILABLE` "The configured AI model was not found. Check GEMINI_MODEL." The provider's 404 appeared only in the server log.
- One extra text-only `generateContent` call with `responseMimeType: "application/json"` and a schema returned `{"ok": true}`. JSON mode works on this model.
- Nothing saved: the classify route and `src/lib/ai/*` contain no storage, database, or file-write calls (checked with `grep`). `git status` was clean after the runs, and Supabase is not configured.
- Key safety: the key was never printed; checks reported only whether it was set and its length. A scan of `.next/static` (client bundles) for Google's `AIza` key prefix found nothing. `.env.local` is git-ignored and untracked.
- Requests made to Google in this session: 2 model-metadata lookups (no generation), 5 image classifications, 1 failed request with a bogus model id, and 1 tiny text call. No retries.
- `npm run check` passed (lint, typecheck, Vitest **104/104**, still fully mocked; Vitest does not read `.env.local`). `npm run build` passed. No live integration test was added to the suite; the procedure above is manual.

Earlier live Gemini verification attempt (2026-10-11, same branch): **stopped, no live request made.**
- `.env.local` did not exist, and neither `GEMINI_API_KEY` nor `GEMINI_MODEL` was in the shell environment. Checked by testing whether each variable was set, without printing values.
- The repo has no real photos to test with. The only image is `public/samples/sample-report.svg`, which `/api/classify` doesn't accept (SVG).
- `npm run check` passed again (lint, typecheck, Vitest 104/104, all mocked) with `.env.local` present. `npm run build` passed. Vitest doesn't load `.env.local`; the tests set their own env values.
- No code changes, and no live integration test was added.

Verification for AI classification (2026-10-11, branch `feat/ai-classification`):
- `npm run check` passed: lint clean, typecheck clean, Vitest **104/104 passed** across 5 files. The 49 new tests in `tests/api/classify.test.ts` mock `GoogleGenAI` but keep the SDK's real `ApiError`. No real key is used and no paid call is made. They cover:
  - Input validation: missing image, text field instead of a file, GIF, spoofed content, declared type differing from the real type, 4 MB + 1 byte (413), oversized `Content-Length` rejected without reading the body, missing `Content-Length` (411), JSON body (415), malformed multipart (400).
  - All four outcomes, all five categories, WebP input, downgrade of low-confidence garbage to `uncertain`, and JSON wrapped in a Markdown fence. The garbage test also checks the request sent to the SDK: model id, inline base64 image, JSON mode, and abort signal.
  - Eleven kinds of invalid model output plus an empty response, each giving 502 `AI_INVALID_RESPONSE`.
  - Missing config gives 503 with no model call. Provider 429, 401, "API key" 400, 404, image-modality 400 and 500 each map correctly, as does a network failure. Responses are checked to contain no key, internal IP address from the provider message, or stack trace.
  - The JSON-mode fallback, and that it is cached per model.
  - `detectImageType` for each accepted format, plus GIF and a non-WebP RIFF file (AVI), which must return `null`.
- Mutation check: disabling the magic-byte check and removing the low-confidence downgrade made 3 tests fail. Restoring them brought the file back to 49/49.
- `npm run build` passed. `/api/classify` is dynamic.
- Smoke test with `next start` and curl:
  - No Gemini env: a valid JPEG returned 503 `CONFIG_MISSING` listing `GEMINI_API_KEY` and `GEMINI_MODEL`.
  - A GIF, an HTML file named `.png`, a text field, a JSON body, and a 4.3 MB file returned 400, 400, 400, 415, and 413.
  - **Against the real Gemini API with a deliberately invalid key** (`GEMINI_MODEL=gemma-3-27b-it`): the client got 502 `AI_UNAVAILABLE` "The AI provider rejected the server's credentials." Google reports a bad key as **HTTP 400** "API key not valid", and the mapping handles it. The raw provider body appeared only in the server log.
- **Not run:** any successful live classification. No valid `GEMINI_API_KEY` was available, so prompt quality, real JSON-mode support, Gemma image support, and real error messages for unsupported models are all unverified.

Verification for the UI dashboard scaffold (2026-10-11, branch `feat/reports-api`):
- `npm run check` passed: lint clean, typecheck clean, Vitest **55/55 passed** across 4 files. The 16 new tests are in `tests/lib/reports-client.test.ts`. They cover:
  - Query-string building.
  - Response validation, including rejection of malformed payloads.
  - 503 `CONFIG_MISSING` mapping to demo mode, while other 503s and 500s map to error.
  - Network failure.
  - The PATCH request shape, and the 404 and non-API-error messages.
  - Counts and filtering.
  - The demo status rules.
  - That the demo data conforms to `Report`.
- `npm run build` passed. `/` is static (the shell prerenders and data loads on the client).
- Browser check at a narrow, mobile-like width using `next start`:
  - **Demo mode (no env vars):**
    - The badge read "Demo data, not saved" and the banner was shown.
    - Counts were 6, 4, 1, 1.
    - The Pending filter showed 4 cards.
    - Clicking "Mark resolved" moved a card to Resolved, with a resolution time shown.
    - The loading state showed "Loading reports…".
  - **Live mode, against a throwaway fake PostgREST server in `/tmp`** (not committed and not real Supabase). The request path was the real supabase-js client, the API route, `reports-client`, and the UI.
    - The badge read "Live data" and 4 reports were listed.
    - During an update, that card's buttons were disabled and showed "Updating…". After the update, the card showed the server-provided `resolved_at`.
    - A simulated failing PATCH showed "Database request failed" on the card, and its buttons re-enabled.
    - With the fake server stopped, Refresh ended in the error state: "Data unavailable" badge and a "Could not load reports" alert. It did **not** fall back to demo data.
- Confirmed in the supabase-js source (`postgrest-js` `processResponse`): `maybeSingle()` maps a zero-row array to `data: null`, which is what the repository relies on. This was not confirmed against a live database.
- **Not run:** anything against a real Supabase database.

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
- When the database is unreachable, `GET /api/reports` takes about **7 seconds** to return 500. supabase-js retries GET requests three times, waiting 1 s, 2 s, then 4 s. The dashboard shows "Refreshing…" during that time. Consider disabling or shortening retries in `getSupabaseAdmin()` if that's a problem for the demo. Not changed yet.
- The UI has no automated component tests. The React components were verified manually in a browser only.
- Route tests use a fake Supabase builder. They verify which filters and updates we send, not that PostgREST returns what we expect. In particular, these are unverified against a live database: `update().select().maybeSingle()` returning `null` when zero rows match, and the timestamp format. Run the manual checks in section K item 1 once Supabase is configured.
- `@types/node` was bumped from `^20` to `^24`, because Vitest 5 requires ≥ 22 and the runtime is Node 24.
- Anyone can change any report's status (no auth, by design). Abuse is possible in a public demo.
- Build prints a warning about a stray `package-lock.json` in the parent home directory. It comes from the local machine, not the repo, and is harmless.
- `npm audit` reports 5 high-severity advisories in transitive dev dependencies from the scaffold. Not triaged.
- npm warns that install scripts for `unrs-resolver`, `protobufjs`, and `@google/genai` are not in `allowScripts`. The build works regardless.
- `leaflet.heat` (0.2.0) is no longer used. The square-cell map draws its own cells (section H). Remove it and `@types/leaflet.heat` when convenient.
- Heat map: OpenStreetMap's public tile servers are fine for a demo, but their usage policy forbids heavy traffic. A real deployment should switch to a tile provider or self-hosted tiles. The attribution must stay visible.
- Heat map: fast refresh keeps the existing Leaflet map, so changes to the tile layer options need a full page reload in dev.
- The SQL migration has not been run against Postgres, so syntax errors there would not have been caught.
- Classification known limitations:
  - Detecting "this model can't read images" and "this model doesn't support JSON mode" relies on matching words in the provider's 400 message. Neither has been seen live, because `gemma-4-26b-a4b-it` supports both. Unmatched cases fall through to the generic 502 `AI_UNAVAILABLE`.
  - Live latency was 4–6 s per image. The UI should show a loading state.
  - Live behavior was checked on only 5 images. Accuracy on real Mumbai user photos (daylight, phone cameras, partial piles) is untested.
  - The 30 s timeout path (504) has no automated test.
  - Model confidence is self-reported and not calibrated. The 0.5 threshold is a starting point.
  - Each request sends the image inline as base64, which is fine up to 4 MB but not efficient.
  - No retries on provider errors, and no rate limiting of our endpoint, so a public demo could spend API quota.
  - The JSON-mode fallback cache is per server process and resets on restart or a new serverless instance.
- Report submission known limitations:
  - If the insert's outcome is ambiguous (for example a network timeout after Postgres actually wrote the row), the cleanup removes the image and the row is left with a broken `image_url`. This is rare, and a reload shows it.
  - If an inserted row fails `reportSchema` (schema drift), the client gets 500 although the row exists. A retry would create a duplicate report.
  - If cleanup itself fails, the object is orphaned in the bucket. Look for `Failed to remove orphaned image reports/…` in the server logs.
  - No duplicate detection, rate limiting, or auth, so anyone can create reports and spend model quota.
  - Each submission costs one model call (two if the UI also calls `/api/classify` for a preview first).
  - `unclear_category` reports have no `severity` or `ai_analysis`, so features that need them must handle `null`.

## K. Current progress and next actions

Done:
- Foundation: scaffold, dependencies, shadcn, contracts, env validation, health route, migration, seed, docs.
- `GET /api/reports` and `PATCH /api/reports/[id]`, with Vitest setup and tests (mocked DB).
- Dashboard scaffold: summary, filters, report list with status buttons, map placeholder, and labeled demo mode.
- `POST /api/classify` with server-only Gemma classification, image validation, and typed errors. Mocked tests plus live verification with `gemma-4-26b-a4b-it`.
- `POST /api/reports`: server-side validation, classification, storage upload, and insert, with cleanup on failure. Mocked tests plus a live run.

Remaining UI work for Aashish (start with `src/components/reports/reports-dashboard.tsx` and `src/components/reports/report-list.tsx`):
- Visual design: colors, status and category styling, typography, spacing, and a desktop layout (for example, map beside the list).
- The heat map (features 6–8) is in `src/components/map/`. Polish it, and add report popups or markers if wanted.
- Show report images. `image_url` is already in every `Report`, but cards don't render it yet.
- Optionally swap the native selects for shadcn components, and add loading skeletons and toasts.
- Report submission form (feature 1–2 UI). `POST /api/reports` is ready (section E).

Next, in priority order:
1. ~~(Tejas) Supabase live~~ **Done 2026-10-11:** every check below passed (section J). Kept for re-verification on other machines:
   - `curl /api/health` shows `supabase: true`.
   - `curl /api/reports` returns 25 sample rows with `has_more: false`.
   - `?status=resolved` returns 4 rows, `?category=construction` returns 4, and `?limit=10&offset=20` returns 5 with `has_more: false`.
   - On one **sample** row only (`is_sample = true`, originally pending): PATCH to `resolved` twice and check `resolved_at` is set once and unchanged the second time. PATCH back to `pending` and check `resolved_at` becomes `null`. That also restores the row.
   - PATCH a random UUID: 404.
   - Point the URL at a wrong host temporarily: expect 500 `DATABASE_ERROR` with no URL or key in the body.
   - The dashboard should show "Live data" with 25 reports.
2. ~~Map UI~~ **Square-cell heat map done 2026-10-11** (Tejas built it at the team's request; section H). Open for Aashish: restyle freely, add clickable cells or markers with report popups, a mobile layout, and delete `map-placeholder.tsx`.
3. ~~(Tejas) Verify live classification~~ **Done 2026-10-11** (section J). Optional follow-ups:
   - Try a few real phone photos from Mumbai in daylight.
   - Decide whether construction rubble should beat `mixed` in the prompt.
   - To re-verify on another machine, put that machine's key in its `.env.local` and repeat the curl steps in section J.
4. ~~(Tejas) `POST /api/reports`~~ **Done 2026-10-11** (section E for the contract, section J for verification).
5. **(Aashish) Report form UI:** photo, geolocation or map pin, optional description, then `POST /api/reports` as multipart. Show the 422 `message` for rejected photos, and add the returned `report` to the list on 201. Downscale photos over 4 MB first. A `/api/classify` preview is optional and costs an extra model call. A small `createReport()` helper in `src/lib/reports-client.ts` would fit the existing pattern; Tejas can add it.
6. Complaint drafts (feature 9). Delay-weighted heat (feature 8) is done.
7. Optional: integration tests against a local Supabase (`supabase start`) to cover real PostgREST behavior.

Dependencies: features 3, 5, and 9 need credentials. Feature 8 needs feature 6.

## L. Change log

### 2026-10-11 · Square-cell heat map
- **Summary:** replaced the map placeholder with a Leaflet map. Reports are grouped into small square cells coloured light pink → red → yellow, over a light grayscale OpenStreetMap that matches the white UI. There are two modes: "All reports" (density) and "Unresolved" (heat grows with days open). It has a legend and hover tooltips.
- **Contract impact:** none. No API, schema, AI, or Supabase changes.
- **Files:**
  - New: `src/lib/heat-grid.ts`, `src/components/map/report-map.tsx`, `src/components/map/report-heat-map.tsx`, `tests/lib/heat-grid.test.ts`.
  - Changed: `src/components/reports/reports-dashboard.tsx` (only the map import and the one JSX line).
  - `map-placeholder.tsx` is left in place but unused. No new dependencies; `leaflet.heat` is now unused.
- **For Aashish:** this is your area. Tejas built it because it was requested now. Restyle freely (section K item 2).
- **Remaining:** clickable report details, mobile polish, and a production tile provider.

### 2026-10-11 · Report submission (`POST /api/reports`)
- **Summary:** end-to-end report creation. The photo is validated, classified on the server, uploaded to `report-images/reports/<uuid>.<ext>`, and inserted as a pending, non-sample report. `not_garbage` and `uncertain` give 422 with nothing stored. Verified with 32 mocked tests and a live run, and the live test row was cleaned up (section J).
- **Contract impact:**
  - `POST /api/reports` is implemented as previously planned (`201 { report }`).
  - New: 422 `VALIDATION_ERROR` with `details.outcome` for rejected photos, and `STORAGE_ERROR` is now used.
  - **Behavior change:** `createReportFieldsSchema` no longer coerces coordinates. Missing, empty, hex, or infinite values are rejected instead of becoming numbers (a missing latitude used to become 0).
  - `unclear_category` reports have `ai_analysis: null`. `Report` and `ClassificationResult` are unchanged.
- **Files:**
  - New: `src/lib/image-upload.ts` (image checks shared with `/api/classify`), `src/lib/reports/storage.ts`, `src/lib/reports/submit-report.ts`, `tests/api/create-report.test.ts`.
  - Changed: `src/app/api/reports/route.ts` (`POST`), `src/app/api/classify/route.ts` (uses the shared helper; same behavior, its 49 tests unchanged), `src/lib/reports/repository.ts` (`insertReport`, exported `parseReport`), `src/lib/api-error.ts` (maps `StorageError`), `src/lib/validation/reports.ts`, `tests/validation/reports.test.ts`, `README.md`.
  - No dashboard or component files were touched.
- **For Aashish:** the API is ready for the report form (section K item 5).
- **Remaining:** the form UI. Optionally, a `createReport()` client helper, and extending the contract so `unclear_category` keeps its partial AI data.

### 2026-10-11 · Live Supabase verification
- **Summary:** with the `trash-map` `service_role` key in `.env.local`, the reports API ran against the real database. 22 checks passed: reads, filters, pagination, the resolve, re-resolve, and reopen cycle on one sample row (restored to pending), 404 and 400 cases, and safe 500s on database failure. The dashboard shows live data.
- **Contract impact:** none. No code changes.
- **Files:** `PROJECT_CONTEXT.md`. `.env.local` is local only.
- **Remaining:** `POST /api/reports` (upload, classify, insert), including the first live storage upload.

### 2026-10-11 · Supabase project, migration, and seed
- **Summary:**
  - Created Supabase project `trash-map` (ref `olohsrjldukoatxxptds`, ap-south-1, Free) through the connector.
  - Applied the reports migration and verified the schema, RLS, index, and bucket against the contracts. Loaded the 25 sample reports.
  - Added the project URL to `.env.local`.
  - The live API checks are **blocked**: the service-role slot holds a publishable key. Added an env check that rejects publishable and anon keys so this misconfiguration shows as `CONFIG_MISSING` instead of an empty "live" dashboard.
- **Contract impact:** none. The schema is exactly as committed. The migration file was renamed to `20261011083327_create_reports.sql` to match the remote history, with contents unchanged. Older log entries mention the old filename.
- **Files:**
  - Renamed: `supabase/migrations/20261011000000_create_reports.sql` → `supabase/migrations/20261011083327_create_reports.sql`.
  - Modified: `src/lib/env.ts`, `README.md`, `PROJECT_CONTEXT.md`.
  - Added: `tests/lib/env.test.ts`.
  - Local only: `.env.local`.
- **Checks:** catalog queries and advisors on the real project, 119/119 tests, and the build (section J). No live API read/write test.
- **Remaining:** the secret key, then the checks in section K item 1. Then `POST /api/reports`.

### 2026-10-11 · Classify test panel
- **Summary:** added a "Classify a photo" panel to the dashboard so classification can be tested in the browser. It does a client-side type and size check, shows a preview, posts to `/api/classify`, and shows the outcome (category, severity, and confidence for garbage; confidence and description otherwise) or a safe error. Nothing is saved.
- **Contract impact:** none. It uses the existing `ClassifyResponse` union and error shape.
- **Files:**
  - Added: `src/lib/classify-client.ts`, `src/components/classify/classify-panel.tsx`, `tests/lib/classify-client.test.ts`.
  - Modified: `src/components/reports/reports-dashboard.tsx` (renders the panel), `PROJECT_CONTEXT.md`.
- **For Aashish:** this is a functional test panel, not a final design. Restyle it freely, or fold it into the report form once `POST /api/reports` exists.
- **Checks:** lint, typecheck, 113/113 tests, build, and the browser check against the live model (section J).

### 2026-10-11 · Live Gemini classification verified
- **Summary:** with a real key in `.env.local` and `GEMINI_MODEL=gemma-4-26b-a4b-it`, five real photos (Wikimedia Commons, licensed) were classified through `POST /api/classify`. A garbage dump gave `garbage`/`mixed`/`medium`. A clean road and a crowd gave `not_garbage`. Construction debris gave `garbage`/`mixed`/`high`. A heavily blurred photo gave `uncertain` (0.3).
- Also confirmed:
  - Inline images and JSON mode both work on this model.
  - A bad model id maps to a safe 502.
  - Invalid inputs still return safe 4xx errors.
  - Nothing is saved.
  - No key appears in client bundles.
- **Contract impact:** none. No code changes.
- **Files:** modified `PROJECT_CONTEXT.md`. `.env.local` was updated locally and is not committed. Test photos and `SOURCES.txt` live in `~/trash-map-test/`, outside the repo.
- **Checks:** `npm run check` (104/104, mocked) and `npm run build` passed, plus the live checks in section J.
- **Remaining:** `POST /api/reports` (needs Supabase credentials). `unclear_category` hasn't been seen live.

### 2026-10-11 · Live Gemini verification: blocked on credentials
- **Summary:** tried to verify real classification. No Gemini credentials were configured and the repo has no real test photos, so no live request was made. Created a git-ignored `.env.local` with `GEMINI_MODEL=gemma-4-26b-a4b-it` (from Google's current list of Gemma models on the Gemini API) and an empty key. Documented what Tejas needs to provide.
- **Contract impact:** none. No code changes.
- **Files:** modified `PROJECT_CONTEXT.md`. Added local-only `.env.local` (not committed).
- **Checks:** `npm run check` (104/104, mocked) and `npm run build` passed. No live-provider test ran.
- **Remaining:** valid key and three photos from Tejas, then run the verification in section K item 3.

### 2026-10-11 · AI image classification
- **Summary:** added `POST /api/classify`. It validates a multipart image (size, declared type, and magic bytes), sends it to the model named by `GEMINI_MODEL` through `@google/genai`, validates the JSON output with Zod, and returns one of four outcomes: `garbage`, `unclear_category`, `not_garbage`, or `uncertain`. It saves nothing. Provider and output failures map to typed errors with safe messages.
- **Contract changes:**
  - New `CLASSIFICATION_OUTCOMES` and `classifyResponseSchema` in `src/lib/validation/reports.ts`.
  - `ClassifyResponse` in `src/types/reports.ts` changed from the planned `{ classification }` to the discriminated union in section E, and a `ClassificationOutcome` type was added. Nothing used the old shape.
  - `ClassificationResult`, `Report`, the reports endpoints, the repository, and the migration are unchanged.
  - For Aashish: when building the upload form, switch on `outcome`; only `garbage` has a `classification` object.
- **Files:**
  - Added: `src/app/api/classify/route.ts`, `src/lib/ai/{gemini,classify-image,errors}.ts`, `src/lib/image-type.ts`, `tests/api/classify.test.ts`.
  - Modified: `src/lib/validation/reports.ts`, `src/types/reports.ts`, `src/lib/api-error.ts` (maps the AI errors), `README.md`, `PROJECT_CONTEXT.md`.
- **Why:** MVP features 3 and 4, and the building block for `POST /api/reports`.
- **Checks:** lint, typecheck, 104/104 tests, build, a mutation check, and curl smoke tests, including one against the real API with an invalid key (section J). No successful live classification was run.
- **Remaining:** verify with a real key and an image-capable Gemma id, then build `POST /api/reports` (section K).

### 2026-10-11 · Reports dashboard UI scaffold
- **Summary:** replaced the placeholder landing page with a working dashboard. It has a header with a data-source badge, summary counts, status and category filters with Refresh, report cards (category, status, description, coordinates with an OpenStreetMap link, dates, sample badge, status buttons), "Load more" pagination, and a map placeholder. Demo mode activates only on 503 `CONFIG_MISSING`.
- **Contract impact:** none. No changes to schemas, types, the repository, API routes, or the migration. The UI consumes the existing `GET /api/reports` and `PATCH /api/reports/[id]` contracts exactly as documented in section E.
- **Files:**
  - Added: `src/components/reports/{reports-dashboard,report-summary,report-filters,report-list}.tsx`, `src/components/reports/labels.ts`, `src/components/map/map-placeholder.tsx`, `src/lib/reports-client.ts`, `src/lib/demo-reports.ts`, `tests/lib/reports-client.test.ts`.
  - Modified: `src/app/page.tsx`, `PROJECT_CONTEXT.md`.
- **Why:** give Aashish a functional baseline to restyle, and exercise the reports API end to end.
- **Checks:** lint, typecheck, 55/55 tests, build, and the browser checks in section J (demo mode, plus live mode against a fake PostgREST).
- **Remaining:** real Supabase verification, the visual design pass, the Leaflet map, and image display (section K).

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
