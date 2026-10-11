import type { Report } from "@/types/reports";

// Pure helpers for the square-cell heat map. No Leaflet imports, so they run
// in tests and could be reused on the server.

export type HeatMode = "density" | "unresolved";

export type HeatCell = {
  col: number;
  row: number;
  /** Sum of report weights in the cell. */
  weight: number;
  /** Reports that contributed a non-zero weight. */
  count: number;
};

type Point = { x: number; y: number };

const DAY_MS = 86_400_000;

/**
 * Density: every report counts 1. Unresolved: resolved reports count 0, and
 * open ones grow from 0.2 to 1 over about 11 days (`min(1, 0.2 + days / 14)`).
 */
export function reportWeight(report: Report, mode: HeatMode, now: number): number {
  if (mode === "density") return 1;
  if (report.status === "resolved") return 0;
  const days = Math.max(0, (now - Date.parse(report.created_at)) / DAY_MS);
  return Math.min(1, 0.2 + days / 14);
}

/** Groups reports into square cells of `cellSize` in the projected space. */
export function buildHeatCells(
  reports: Report[],
  options: { mode: HeatMode; now: number; cellSize: number; project: (lat: number, lng: number) => Point },
): HeatCell[] {
  const cells = new Map<string, HeatCell>();
  for (const report of reports) {
    const weight = reportWeight(report, options.mode, options.now);
    if (weight <= 0) continue;
    const { x, y } = options.project(report.latitude, report.longitude);
    const col = Math.floor(x / options.cellSize);
    const row = Math.floor(y / options.cellSize);
    const key = `${col}:${row}`;
    const cell = cells.get(key);
    if (cell) {
      cell.weight += weight;
      cell.count += 1;
    } else {
      cells.set(key, { col, row, weight, count: 1 });
    }
  }
  return [...cells.values()];
}

/**
 * Weight that maps to the hottest colour. Never below `floor`, so a lone
 * report shows as a cool cell instead of a maximum-intensity hotspot.
 */
export function heatScale(cells: HeatCell[], floor = 3): number {
  return cells.reduce((max, cell) => Math.max(max, cell.weight), floor);
}

/** Cool to hot: light pink, pink, red, yellow. */
export const HEAT_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, "#f9a8d4"],
  [0.35, "#ec4899"],
  [0.7, "#ef4444"],
  [1, "#fbbf24"],
];

export function heatColor(t: number): string {
  const v = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [end, to] = HEAT_STOPS[i];
    if (v <= end) {
      const [start, from] = HEAT_STOPS[i - 1];
      return mix(from, to, (v - start) / (end - start));
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}

function mix(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const channel = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function parseHex(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
