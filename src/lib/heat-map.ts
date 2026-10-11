import type { Report } from "@/types/reports";

export type HeatMode = "density" | "delay";

/** `[latitude, longitude, weight]`, the point format `leaflet.heat` expects. */
export type HeatPoint = [number, number, number];

export const MUMBAI_CENTER: [number, number] = [19.076, 72.8777];
export const MUMBAI_ZOOM = 11;

/** India plus a margin; the map can't be panned outside it. */
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [4, 64],
  [38, 100],
];
export const INDIA_MIN_ZOOM = 4;

const DAY_MS = 86_400_000;
export const DELAY_BASE_WEIGHT = 0.2;
export const DELAY_FULL_AFTER_DAYS = 14;

/**
 * Weight sum at which a spot shows as "Severe". Both modes share it, so one
 * unit always means one report (density) or one long-open report (delay).
 */
export const HEAT_MAX = 3;

export const HEAT_LEVELS = [
  { label: "Low", color: "#fde047" },
  { label: "Medium", color: "#fb923c" },
  { label: "High", color: "#ef4444" },
  { label: "Severe", color: "#991b1b" },
] as const;

/** `leaflet.heat` gradient: intensity stop (0–1) to colour. */
export const HEAT_GRADIENT: Record<number, string> = Object.fromEntries(
  HEAT_LEVELS.map((level, index) => [(index + 1) / HEAT_LEVELS.length, level.color]),
);

export const HEAT_MODE_LABELS: Record<HeatMode, string> = {
  density: "Density",
  delay: "Unresolved delay",
};

export const HEAT_MODE_HINTS: Record<HeatMode, string> = {
  density: "Every report counts equally. Severe means about 3 or more reports in one spot.",
  delay:
    "Resolved reports are hidden. Open reports grow hotter over 14 days. Severe means about 3 reports open for 2 weeks in one spot.",
};

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Unresolved-delay weight: `min(1, 0.2 + days_open / 14)`.
 * A new report starts at 0.2 and reaches the cap of 1 after about 11 days,
 * so one very old report can never outweigh a cluster. Resolved reports get
 * `null` and are left off the map.
 */
export function delayWeight(report: Pick<Report, "status" | "created_at">, now: number): number | null {
  if (report.status === "resolved") return null;
  const created = Date.parse(report.created_at);
  const daysOpen = Number.isFinite(created) ? Math.max(0, (now - created) / DAY_MS) : 0;
  return Math.min(1, DELAY_BASE_WEIGHT + daysOpen / DELAY_FULL_AFTER_DAYS);
}

export function buildHeatPoints(reports: readonly Report[], mode: HeatMode, now: number): HeatPoint[] {
  const points: HeatPoint[] = [];
  for (const report of reports) {
    if (!isValidCoordinate(report.latitude, report.longitude)) continue;
    const weight = mode === "density" ? 1 : delayWeight(report, now);
    if (weight === null) continue;
    points.push([report.latitude, report.longitude, weight]);
  }
  return points;
}
