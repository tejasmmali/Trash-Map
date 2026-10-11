# Trash Map

Open-source garbage reporting and heat map for Mumbai, built for **Hacktoberfest Hack Day Mumbai × FAIR**.

Citizens photograph a garbage pile, pin its location, and an AI model (Gemma via the Gemini API) classifies it. Reports appear on an OpenStreetMap-based map with a heat layer where unresolved reports glow hotter the longer they wait. The app can also draft a complaint to the municipal corporation.

> **Status:** project foundation only. Reporting, the map, and AI classification are not implemented yet. See [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) for the live status of every feature.

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
2. Run `supabase/migrations/20261011000000_create_reports.sql` in the SQL editor (or `supabase db push` with the Supabase CLI). This creates the `reports` table and the public `report-images` storage bucket.
3. Optionally run `supabase/seed.sql` to load 25 clearly marked sample reports across Mumbai.
4. Copy the project URL and service-role key into `.env.local`.

### Gemini

1. Create an API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Set `GEMINI_API_KEY` and `GEMINI_MODEL` (a Gemma model id with image input that your key can access).

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm run start`     | Serve the production build            |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | Generate route types and run `tsc`    |
| `npm run check`     | Lint and typecheck                    |

## Contributing

Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) first. It covers architecture, shared contracts, file ownership, and the current status.

## License

[MIT](./LICENSE)
