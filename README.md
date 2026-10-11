# Trash Map

Open-source garbage reporting and heat map for Mumbai, built for **Hacktoberfest Hack Day Mumbai × FAIR**.

Citizens photograph a garbage pile, pin its location, and an AI model (Gemma via the Gemini API) classifies it. Reports appear on an OpenStreetMap-based map with a heat layer where unresolved reports glow hotter the longer they wait. The app can also draft a complaint to the municipal corporation.

> **Status:** MVP complete. On the dashboard you can upload a photo, pick the location (click the map, search a place, or use your device location), and submit. The server classifies the photo with the configured Gemma model, stores it, and saves the report, which then appears in the list and on the map. Reports can be moved between pending, in progress, and resolved. The map is an India-focused OpenStreetMap view with a density / unresolved-delay heat toggle and location search (OpenStreetMap Nominatim, used within its [usage policy](https://operations.osmfoundation.org/policies/nominatim/)). Without Supabase credentials the dashboard runs in a clearly labeled read-only demo mode. The full flow was verified live against Supabase and `gemma-4-26b-a4b-it`. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the status of every feature.

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

The `report-images` bucket is **public**: anyone with a photo's URL can view it. That is what lets the list and map show photos with plain `<img>` URLs. Uploads and all database access go through the server with the secret key, so the public can read photos but not write them. Making the bucket private would require switching the app to signed URLs.

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

## Tests

`npm run check` runs ESLint, the TypeScript check, and the Vitest suite. The tests mock Supabase, Gemini, and the geocoder, so they need no credentials and make no network calls. A live check of the real integrations has to be done by hand: run `npm run dev` with `.env.local` filled in, submit a garbage photo and a photo without garbage from the dashboard, and confirm that only the first one is saved.

## Deploying to Vercel

The app runs on Vercel as a standard Next.js project. No `vercel.json` is needed: the dashboard is prerendered, and the API routes run as Node.js functions.

1. Push the branch to GitHub, then in Vercel choose **Add New → Project** and import the repository. The framework preset (Next.js), build command, and output settings are detected automatically.
2. Under **Settings → Environment Variables**, add these for **Production** and **Preview**:

   | Variable                    | Required | Notes                                                                        |
   | --------------------------- | -------- | ---------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`  | Yes      | Supabase project URL                                                         |
   | `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Secret key. Mark it **Sensitive**. Never prefix it with `NEXT_PUBLIC_`.      |
   | `GEMINI_API_KEY`            | Yes      | Mark it **Sensitive**                                                        |
   | `GEMINI_MODEL`              | Yes      | e.g. `gemma-4-26b-a4b-it`                                                    |
   | `SUPABASE_STORAGE_BUCKET`   | No       | Defaults to `report-images`                                                  |
   | `NEXT_PUBLIC_GEOCODER_URL`  | No       | Defaults to public Nominatim. Built into the page, so change it with a redeploy. |

   `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not used yet and can be left out.
3. Deploy, open the deployment URL, and check `/api/health`. Every value should be `true`. Then submit one test report from the dashboard.
4. If something fails, open the deployment's **Logs** tab. Server errors are logged with their category and never include keys or image data.

Vercel limits a function request body to 4.5 MB, which fits the app's 4 MB photo limit.

## Contributing

Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) first. It covers architecture, shared contracts, file ownership, and the current status.

## License

[MIT](./LICENSE)
