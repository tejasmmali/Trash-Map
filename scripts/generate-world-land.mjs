/**
 * Regenerates src/components/map/world-land.ts from Natural Earth 50m land.
 *
 *   npm install --no-save topojson-client
 *   node scripts/generate-world-land.mjs
 *
 * Source: scripts/land-50m.json (world-atlas `land-50m.json` TopoJSON,
 * https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json).
 *
 * Output: three equirectangular land masks (2°, 1°, 0.5° cells) so the dotted
 * map can swap to finer dots as the user zooms in. Rasterized with an even-odd
 * scanline fill at 3× the finest grid, then OR/threshold-downsampled.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const topojson = require("topojson-client");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const LEVELS = [
  { cols: 180, rows: 90 },
  { cols: 360, rows: 180 },
  { cols: 720, rows: 360 },
];
const FINE_W = 2160;
const FINE_H = 1080;
const LAND_FRACTION = 1 / 9;

const topology = JSON.parse(
  fs.readFileSync(path.join(__dirname, "land-50m.json"), "utf8"),
);
const land = topojson.feature(topology, topology.objects.land);
const features = land.type === "FeatureCollection" ? land.features : [land];

// Collect every ring edge. Natural Earth land polygons do not overlap, so an
// even-odd fill over all rings handles outer rings and holes together.
const edges = [];
for (const feature of features) {
  const geometry = feature.geometry;
  if (!geometry) continue;
  const polys =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        let [x1, y1] = ring[j];
        let [x2, y2] = ring[i];
        if (Math.abs(x1 - x2) > 180) {
          // The ring crosses the antimeridian here (Chukotka, Fiji, …). Unwrap
          // onto the +180 side, split at 180, and close the flat outline by
          // adding edges from the crossing point up to the pole on both sides.
          // Two crossings of one ring cancel above them, so even-odd stays right.
          if (x1 < x2) x1 += 360;
          else x2 += 360;
          const t = x1 === x2 ? 0 : Math.min(1, Math.max(0, (180 - x1) / (x2 - x1)));
          const ym = y1 + t * (y2 - y1);
          const parts = [
            { x1: Math.min(x1, 180), y1: x1 <= 180 ? y1 : ym, x2: Math.min(x2, 180), y2: x2 <= 180 ? y2 : ym },
            { x1: Math.max(x1, 180) - 360, y1: x1 >= 180 ? y1 : ym, x2: Math.max(x2, 180) - 360, y2: x2 >= 180 ? y2 : ym },
            { x1: 180, y1: ym, x2: 180, y2: 90 },
            { x1: -180, y1: ym, x2: -180, y2: 90 },
          ];
          for (const e of parts) {
            if (e.y1 === e.y2) continue;
            edges.push({ ...e, ymin: Math.min(e.y1, e.y2), ymax: Math.max(e.y1, e.y2) });
          }
          continue;
        }
        if (y1 === y2) continue;
        edges.push({ x1, y1, x2, y2, ymin: Math.min(y1, y2), ymax: Math.max(y1, y2) });
      }
    }
  }
}

// Bucket edges by fine row to avoid scanning every edge per scanline.
const rowBuckets = Array.from({ length: FINE_H }, () => []);
const rowOfLat = (lat) => ((90 - lat) / 180) * FINE_H;
for (const edge of edges) {
  const r0 = Math.max(0, Math.floor(rowOfLat(edge.ymax)));
  const r1 = Math.min(FINE_H - 1, Math.ceil(rowOfLat(edge.ymin)));
  for (let r = r0; r <= r1; r++) rowBuckets[r].push(edge);
}

const fine = new Uint8Array(FINE_W * FINE_H);
for (let r = 0; r < FINE_H; r++) {
  const lat = 90 - ((r + 0.5) / FINE_H) * 180;
  const xs = [];
  for (const e of rowBuckets[r]) {
    // Half-open rule so shared vertices count once.
    if (lat >= e.ymin && lat < e.ymax) {
      xs.push(e.x1 + ((lat - e.y1) * (e.x2 - e.x1)) / (e.y2 - e.y1));
    }
  }
  if (xs.length < 2) continue;
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const c0 = Math.max(0, Math.ceil(((xs[k] + 180) / 360) * FINE_W - 0.5));
    const c1 = Math.min(FINE_W - 1, Math.floor(((xs[k + 1] + 180) / 360) * FINE_W - 0.5));
    for (let c = c0; c <= c1; c++) fine[r * FINE_W + c] = 1;
  }
}

function downsample({ cols, rows }) {
  const bx = FINE_W / cols;
  const by = FINE_H / rows;
  const mask = new Uint8Array(cols * rows);
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let hits = 0;
      for (let y = 0; y < by; y++) {
        const base = (row * by + y) * FINE_W + col * bx;
        for (let x = 0; x < bx; x++) hits += fine[base + x];
      }
      if (hits / (bx * by) >= LAND_FRACTION) {
        mask[row * cols + col] = 1;
        count++;
      }
    }
  }
  return { mask, count };
}

function toBase64(mask) {
  const bytes = Buffer.alloc(Math.ceil(mask.length / 8));
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) bytes[i >> 3] |= 1 << (i & 7);
  }
  return bytes.toString("base64");
}

const levelSources = LEVELS.map((level) => {
  const { mask, count } = downsample(level);
  console.log(
    `${level.cols}×${level.rows}: ${count}/${mask.length} land cells (${((count / mask.length) * 100).toFixed(1)}%)`,
  );
  return `  { cols: ${level.cols}, rows: ${level.rows}, b64:\n    "${toBase64(mask)}" },`;
});

const out = `/**
 * Auto-generated from Natural Earth 50m land (world-atlas TopoJSON).
 * Run \`node scripts/generate-world-land.mjs\` to regenerate. Do not hand-edit.
 */

export const WORLD_LAT_MAX = 90;
export const WORLD_LAT_MIN = -90;

export type WorldLevel = {
  /** Cells across 360° of longitude. */
  cols: number;
  /** Cells across 180° of latitude. */
  rows: number;
  /** One byte per cell, 1 = land. Row-major, row 0 = north. */
  mask: Uint8Array;
};

type PackedLevel = { cols: number; rows: number; b64: string };

const PACKED: readonly PackedLevel[] = [
${levelSources.join("\n")}
];

function decodeMask(b64: string, len: number): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const mask = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    mask[i] = (bytes[i >> 3] >> (i & 7)) & 1;
  }
  return mask;
}

/** Coarse → fine. Index 0 is the whole-world default. */
export const WORLD_LEVELS: readonly WorldLevel[] = PACKED.map((level) => ({
  cols: level.cols,
  rows: level.rows,
  mask: decodeMask(level.b64, level.cols * level.rows),
}));

export const WORLD_COLS = WORLD_LEVELS[0].cols;
export const WORLD_ROWS = WORLD_LEVELS[0].rows;
export const WORLD_LAND_MASK = WORLD_LEVELS[0].mask;

export function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function latLngToCell(
  lat: number,
  lng: number,
  level = 0,
): { col: number; row: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { cols, rows } = WORLD_LEVELS[level] ?? WORLD_LEVELS[0];
  if (lat > WORLD_LAT_MAX || lat < WORLD_LAT_MIN) return null;
  const col = Math.floor(((normalizeLng(lng) + 180) / 360) * cols);
  const row = Math.floor(((WORLD_LAT_MAX - lat) / (WORLD_LAT_MAX - WORLD_LAT_MIN)) * rows);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return { col, row };
}

export function isLandCell(col: number, row: number, level = 0): boolean {
  const current = WORLD_LEVELS[level] ?? WORLD_LEVELS[0];
  if (col < 0 || col >= current.cols || row < 0 || row >= current.rows) return false;
  return current.mask[row * current.cols + col] === 1;
}
`;

const dest = path.join(root, "src/components/map/world-land.ts");
fs.writeFileSync(dest, out);
console.log(`Wrote ${dest} (${edges.length} edges rasterized)`);
