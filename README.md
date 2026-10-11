# Trash Map

Open-source garbage reporting and heat map for Mumbai, built for **Hacktoberfest Hack Day Mumbai × FAIR**.

Citizens photograph a garbage pile, pin its location, and an AI model (Gemma via the Gemini API) classifies it. Reports appear on an OpenStreetMap-based map with a heat layer where unresolved reports glow hotter the longer they wait. The app can also draft a complaint to the municipal corporation.

> **Status:** early. The dashboard lists reports and updates their status through `GET /api/reports` and `PATCH /api/reports/[id]`. Without Supabase credentials it runs in a clearly labeled demo mode. `POST /api/classify` classifies a photo with the configured Gemma model (verified live with `gemma-4-26b-a4b-it`). `POST /api/reports` classifies, uploads, and saves a new report (verified live against Supabase). The dashboard has a square-cell heat map (all reports, or unresolved reports weighted by days open) on a light OpenStreetMap base. The report form UI is not implemented yet. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the live status of every feature.

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Postgres + Storage) · Leaflet + leaflet.heat · Google Gen AI SDK (`@google/genai`) · Zod

## Local setup

Requirements: Node.js 20.9+ (developed on Node 24) and npm.

```bash
git clone https://github.com/tejasmmali/Trash-Map.git
cd Trash-Map
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Check which integrations are configured (returns booleans only, never values):

```bash
curl http://localhost:3000/api/health
```

### Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/20261011083327_create_reports.sql` in the SQL editor (or `supabase db push` with the Supabase CLI). This creates the `reports` table and the public `report-images` storage bucket.
3. Optionally run `supabase/seed.sql` to load 25 clearly marked sample reports across Mumbai.
4. Copy the project URL and the **secret** key (`sb_secret_…`, or the legacy `service_role` key) into `.env.local`. A publishable or `anon` key is rejected, because it can't read the table.

### Gemini

1. Create an API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` (a Gemma model id with image input that your key can access). The key is read on the server only. There is no default model, and the app does not switch models for you.
3. Try it:

   ```bash
   curl -F image=@photo.jpg http://localhost:3000/api/classify
   ```

   - Images must be JPEG, PNG, or WebP and at most 4 MB. The file content is checked, not just the extension.
   - The response is 200 with an `outcome`:
     - `garbage`: includes a `classification` with `category`, `severity`, `confidence`, and `description`.
     - `unclear_category`, `not_garbage`, or `uncertain`: includes `confidence` and `description`.
   - Nothing is saved.
   - Errors:
     - 503 `CONFIG_MISSING` if the variables are unset.
     - 502 `AI_UNAVAILABLE` if the model can't read images or the key is rejected.
     - 502 `AI_INVALID_RESPONSE` if the model's answer is unusable.
   - Full contract: section E of `PROJECT_CONTEXT.md`.

### Submitting a report

With both Supabase and Gemini configured:

```bash
curl -F image=@photo.jpg -F latitude=19.0178 -F longitude=72.8478 -F "description=Near the bus stop" \
  http://localhost:3000/api/reports
```

- The server classifies the photo itself. Category, confidence, status, and every other report field are set by the server, and anything else sent in the form is ignored.
- `garbage` is saved as reported. `unclear_category` is saved as `other`. The photo goes to `report-images/reports/<report-id>.<ext>`, and the response is `201 { report }`.
- `not_garbage` and `uncertain` return 422 with a message for the user, and nothing is uploaded or saved.
- If the database insert fails, the uploaded photo is removed again.
- Each submission makes one model call.

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm run start`     | Serve the production build            |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | Generate route types and run `tsc`    |
| `npm run test`      | Run the Vitest suite once             |
| `npm run check`     | Lint, typecheck, and tests            |

## Contributing

Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) first. It covers architecture, shared contracts, file ownership, and the current status.

## License

[MIT](./LICENSE)
