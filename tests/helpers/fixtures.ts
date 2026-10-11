export const REPORT_ID = "3f1c2b4a-1d2e-4f5a-8b6c-7d8e9f0a1b2c";

/** Shaped like a row returned by PostgREST for `public.reports`. */
export function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    image_url: "/samples/sample-report.svg",
    latitude: 19.0178,
    longitude: 72.8478,
    category: "mixed",
    description: "[SAMPLE] Overflowing bins outside Dadar station",
    confidence: null,
    status: "pending",
    created_at: "2026-09-29T06:48:00.123456+00:00",
    resolved_at: null,
    ai_analysis: null,
    is_sample: true,
    ...overrides,
  };
}
