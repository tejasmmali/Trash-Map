import type { Report } from "@/types/reports";

// Shown only when the API reports missing Supabase configuration. These are
// not community submissions; the UI labels them as demo data and never
// persists changes to them. Safe to delete once Supabase is configured.

const base = {
  image_url: "/samples/sample-report.svg",
  confidence: null,
  ai_analysis: null,
  is_sample: true,
} as const;

export const DEMO_REPORTS: Report[] = [
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000001",
    latitude: 19.0178,
    longitude: 72.8478,
    category: "mixed",
    description: "[SAMPLE] Overflowing bins outside Dadar station",
    status: "pending",
    created_at: "2026-09-29T09:15:00+05:30",
    resolved_at: null,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000002",
    latitude: 19.049,
    longitude: 72.826,
    category: "plastic",
    description: "[SAMPLE] Plastic bottles along Bandra Reclamation",
    status: "pending",
    created_at: "2026-10-08T17:40:00+05:30",
    resolved_at: null,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000003",
    latitude: 19.1197,
    longitude: 72.8826,
    category: "construction",
    description: "[SAMPLE] Debris dumped on a footpath in Marol",
    status: "in_progress",
    created_at: "2026-10-02T11:05:00+05:30",
    resolved_at: null,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000004",
    latitude: 18.9474,
    longitude: 72.8343,
    category: "organic",
    description: "[SAMPLE] Vegetable waste behind Crawford Market",
    status: "pending",
    created_at: "2026-10-06T07:30:00+05:30",
    resolved_at: null,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000005",
    latitude: 19.0988,
    longitude: 72.8267,
    category: "plastic",
    description: "[SAMPLE] Litter along Juhu Beach after the weekend",
    status: "resolved",
    created_at: "2026-10-07T08:00:00+05:30",
    resolved_at: "2026-10-09T16:20:00+05:30",
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000006",
    latitude: 18.979,
    longitude: 72.833,
    category: "other",
    description: "[SAMPLE] E-waste and old mattresses in Byculla",
    status: "pending",
    created_at: "2026-09-19T13:45:00+05:30",
    resolved_at: null,
  },
];
