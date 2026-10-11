import { describe, expect, it } from "vitest";
import { HEAT_GRADIENT, HEAT_LEVELS, buildHeatPoints, delayWeight, isValidCoordinate } from "@/lib/heat-map";
import { reportRow } from "../helpers/fixtures";
import { reportSchema } from "@/lib/validation/reports";
import type { Report } from "@/types/reports";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const DAY = 86_400_000;

function report(overrides: Partial<Report> = {}): Report {
  return { ...reportSchema.parse(reportRow()), ...overrides };
}

function openedDaysAgo(days: number, status: Report["status"] = "pending") {
  return { status, created_at: new Date(NOW - days * DAY).toISOString() };
}

describe("delayWeight", () => {
  it("starts at 0.2 for a new report", () => {
    expect(delayWeight(openedDaysAgo(0), NOW)).toBeCloseTo(0.2);
  });

  it("grows by 1/14 per day open", () => {
    expect(delayWeight(openedDaysAgo(7), NOW)).toBeCloseTo(0.7);
    expect(delayWeight(openedDaysAgo(7, "in_progress"), NOW)).toBeCloseTo(0.7);
  });

  it("is capped at 1 so one old report can't dominate", () => {
    expect(delayWeight(openedDaysAgo(11.2), NOW)).toBe(1);
    expect(delayWeight(openedDaysAgo(365), NOW)).toBe(1);
  });

  it("treats future timestamps as just opened", () => {
    expect(delayWeight(openedDaysAgo(-3), NOW)).toBeCloseTo(0.2);
  });

  it("excludes resolved reports", () => {
    expect(delayWeight(openedDaysAgo(30, "resolved"), NOW)).toBeNull();
  });
});

describe("buildHeatPoints", () => {
  const reports = [
    report({ id: "a", latitude: 19.01, longitude: 72.84, ...openedDaysAgo(0) }),
    report({ id: "b", latitude: 19.02, longitude: 72.85, ...openedDaysAgo(28, "resolved") }),
    report({ id: "c", latitude: 19.03, longitude: 72.86, ...openedDaysAgo(7, "in_progress") }),
  ];

  it("uses each report's real coordinates with weight 1 in density mode", () => {
    expect(buildHeatPoints(reports, "density", NOW)).toEqual([
      [19.01, 72.84, 1],
      [19.02, 72.85, 1],
      [19.03, 72.86, 1],
    ]);
  });

  it("drops resolved reports and weights by age in delay mode", () => {
    const points = buildHeatPoints(reports, "delay", NOW);
    expect(points.map(([lat, lng]) => [lat, lng])).toEqual([
      [19.01, 72.84],
      [19.03, 72.86],
    ]);
    expect(points[0][2]).toBeCloseTo(0.2);
    expect(points[1][2]).toBeCloseTo(0.7);
  });

  it("follows status changes", () => {
    const reopened = reports.map((item) => (item.id === "b" ? { ...item, status: "pending" as const } : item));
    expect(buildHeatPoints(reopened, "delay", NOW)).toHaveLength(3);
    const resolved = reports.map((item) => ({ ...item, status: "resolved" as const }));
    expect(buildHeatPoints(resolved, "delay", NOW)).toEqual([]);
  });

  it("skips invalid coordinates and handles empty input", () => {
    const bad = [
      report({ latitude: Number.NaN }),
      report({ longitude: Number.POSITIVE_INFINITY }),
      report({ latitude: 91 }),
      report({ longitude: -181 }),
    ];
    expect(buildHeatPoints(bad, "density", NOW)).toEqual([]);
    expect(buildHeatPoints([], "delay", NOW)).toEqual([]);
  });
});

describe("isValidCoordinate", () => {
  it("accepts the WGS84 range including its edges", () => {
    expect(isValidCoordinate(19.07, 72.87)).toBe(true);
    expect(isValidCoordinate(-90, 180)).toBe(true);
    expect(isValidCoordinate(90.0001, 0)).toBe(false);
  });
});

describe("legend", () => {
  it("has one gradient stop per legend level, ending at full intensity", () => {
    const stops = Object.entries(HEAT_GRADIENT)
      .map(([stop, color]) => [Number(stop), color] as const)
      .sort(([a], [b]) => a - b);
    expect(stops).toEqual(HEAT_LEVELS.map((level, index) => [(index + 1) / 4, level.color]));
  });
});
