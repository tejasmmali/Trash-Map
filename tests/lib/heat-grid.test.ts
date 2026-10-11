import { describe, expect, it } from "vitest";
import { buildHeatCells, heatColor, heatScale, reportWeight, type HeatCell } from "@/lib/heat-grid";
import { reportSchema } from "@/lib/validation/reports";
import type { Report } from "@/types/reports";
import { reportRow } from "../helpers/fixtures";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const DAY = 86_400_000;

function report(overrides: Record<string, unknown> = {}): Report {
  return reportSchema.parse(reportRow(overrides));
}

function daysAgo(days: number) {
  return new Date(NOW - days * DAY).toISOString();
}

// Treat longitude as x and latitude as y so cells are easy to reason about.
const project = (lat: number, lng: number) => ({ x: lng, y: lat });

describe("reportWeight", () => {
  it("counts every report as 1 in density mode", () => {
    expect(reportWeight(report({ status: "resolved", resolved_at: daysAgo(1) }), "density", NOW)).toBe(1);
  });

  it("ignores resolved reports in unresolved mode", () => {
    expect(reportWeight(report({ status: "resolved", resolved_at: daysAgo(1) }), "unresolved", NOW)).toBe(0);
  });

  it("grows with days open and caps at 1", () => {
    expect(reportWeight(report({ created_at: daysAgo(0) }), "unresolved", NOW)).toBeCloseTo(0.2);
    expect(reportWeight(report({ created_at: daysAgo(7) }), "unresolved", NOW)).toBeCloseTo(0.7);
    expect(reportWeight(report({ created_at: daysAgo(30) }), "unresolved", NOW)).toBe(1);
    expect(reportWeight(report({ status: "in_progress", created_at: daysAgo(30) }), "unresolved", NOW)).toBe(1);
  });

  it("treats a future timestamp as just created", () => {
    expect(reportWeight(report({ created_at: daysAgo(-2) }), "unresolved", NOW)).toBeCloseTo(0.2);
  });
});

describe("buildHeatCells", () => {
  it("groups reports into square cells and sums their weights", () => {
    const reports = [
      report({ id: "00000000-0000-4000-8000-000000000001", latitude: 10.2, longitude: 20.1 }),
      report({ id: "00000000-0000-4000-8000-000000000002", latitude: 10.9, longitude: 20.8 }),
      report({ id: "00000000-0000-4000-8000-000000000003", latitude: 11.1, longitude: 20.5 }),
    ];

    const cells = buildHeatCells(reports, { mode: "density", now: NOW, cellSize: 1, project });

    expect(cells).toHaveLength(2);
    expect(cells).toContainEqual({ col: 20, row: 10, weight: 2, count: 2 });
    expect(cells).toContainEqual({ col: 20, row: 11, weight: 1, count: 1 });
  });

  it("puts points exactly on a boundary in the next cell, including negatives", () => {
    const cells = buildHeatCells(
      [report({ latitude: -1, longitude: 2 }), report({ latitude: -0.5, longitude: 1.999 })],
      { mode: "density", now: NOW, cellSize: 1, project },
    );
    expect(cells).toContainEqual({ col: 2, row: -1, weight: 1, count: 1 });
    expect(cells).toContainEqual({ col: 1, row: -1, weight: 1, count: 1 });
  });

  it("skips reports with zero weight", () => {
    const cells = buildHeatCells([report({ status: "resolved", resolved_at: daysAgo(1) })], {
      mode: "unresolved",
      now: NOW,
      cellSize: 1,
      project,
    });
    expect(cells).toEqual([]);
  });
});

describe("heatScale", () => {
  const cell = (weight: number): HeatCell => ({ col: 0, row: 0, weight, count: 1 });

  it("uses the hottest cell, but never less than the floor", () => {
    expect(heatScale([])).toBe(3);
    expect(heatScale([cell(1), cell(2)])).toBe(3);
    expect(heatScale([cell(1), cell(8)])).toBe(8);
  });
});

describe("heatColor", () => {
  it("runs from light pink through pink and red to yellow", () => {
    expect(heatColor(0)).toBe("#f9a8d4");
    expect(heatColor(0.35)).toBe("#ec4899");
    expect(heatColor(0.7)).toBe("#ef4444");
    expect(heatColor(1)).toBe("#fbbf24");
  });

  it("interpolates and clamps", () => {
    expect(heatColor(0.85)).toMatch(/^#[0-9a-f]{6}$/);
    expect(heatColor(-1)).toBe("#f9a8d4");
    expect(heatColor(5)).toBe("#fbbf24");
    expect(heatColor(Number.NaN)).toBe("#f9a8d4");
  });
});
