import type { Report } from "@/types/reports";

export const MUMBAI_CENTER = { lat: 19.076, lng: 72.8777 } as const;
export const MUMBAI_ZOOM = 12;
export const NEIGHBORHOOD_ZOOM = 14;

export type MapLayerMode = "density" | "reports" | "unresolved";

export const LAYER_LABELS: Record<MapLayerMode, string> = {
  density: "Garbage density",
  reports: "Individual reports",
  unresolved: "Unresolved delay",
};

export const LAND_CELL_COLOR = "#6d8178";
export const MAP_SEA_COLOR = "#2f4a42";

export const DENSITY_SWATCHES = [
  { key: "low", label: "Low", color: "#f3d7cb" },
  { key: "medium", label: "Medium", color: "#efc84a" },
  { key: "high", label: "High", color: "#e8895a" },
  { key: "severe", label: "Severe", color: "#d9555f" },
] as const;

export const MUMBAI_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: "Dadar", lat: 19.0178, lng: 72.8478 },
  { name: "Bandra", lat: 19.0596, lng: 72.8295 },
  { name: "Andheri", lat: 19.1197, lng: 72.8468 },
  { name: "Colaba", lat: 18.9067, lng: 72.8147 },
  { name: "Juhu", lat: 19.0988, lng: 72.8267 },
  { name: "Powai", lat: 19.1176, lng: 72.906 },
  { name: "Worli", lat: 19.0177, lng: 72.817 },
  { name: "Byculla", lat: 18.979, lng: 72.833 },
  { name: "Marol", lat: 19.1197, lng: 72.8826 },
  { name: "Crawford Market", lat: 18.9474, lng: 72.8343 },
  { name: "Bandra Reclamation", lat: 19.049, lng: 72.826 },
  { name: "Marine Drive", lat: 18.9432, lng: 72.8235 },
];

export function densityTier(value: number, maxValue: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0 || maxValue <= 0) return 0;
  if (maxValue <= 4) {
    if (value <= 1) return 1;
    if (value <= 2) return 2;
    if (value <= 3) return 3;
    return 4;
  }
  const ratio = value / maxValue;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

export function densityColor(tier: 0 | 1 | 2 | 3 | 4): string | null {
  if (tier === 1) return DENSITY_SWATCHES[0].color;
  if (tier === 2) return DENSITY_SWATCHES[1].color;
  if (tier === 3) return DENSITY_SWATCHES[2].color;
  if (tier === 4) return DENSITY_SWATCHES[3].color;
  return null;
}

export function delayWeight(report: Report, nowMs = Date.now()): number {
  if (report.status === "resolved") return 0;
  const daysOpen =
    (nowMs - new Date(report.created_at).getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(1, 0.2 + daysOpen / 14);
}

export function reportWeight(report: Report, mode: MapLayerMode, nowMs = Date.now()): number {
  if (mode === "unresolved") return delayWeight(report, nowMs);
  if (mode === "density" || mode === "reports") return 1;
  return 0;
}
