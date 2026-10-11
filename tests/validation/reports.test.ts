import { describe, expect, it } from "vitest";
import {
  classificationResultSchema,
  createReportFieldsSchema,
  imageFileSchema,
  listReportsQuerySchema,
  reportSchema,
} from "@/lib/validation/reports";
import { reportRow } from "../helpers/fixtures";

describe("reportSchema", () => {
  it("accepts a PostgREST-shaped row with microsecond timestamps", () => {
    expect(reportSchema.safeParse(reportRow()).success).toBe(true);
  });

  it("accepts a resolved row with a valid ai_analysis", () => {
    const row = reportRow({
      status: "resolved",
      resolved_at: "2026-10-10T12:00:00+00:00",
      confidence: 0.87,
      ai_analysis: {
        is_garbage: true,
        category: "plastic",
        confidence: 0.87,
        description: "Plastic bottles",
        severity: "medium",
      },
    });
    expect(reportSchema.safeParse(row).success).toBe(true);
  });

  it.each([
    ["unknown category", { category: "glass" }],
    ["latitude out of range", { latitude: 91 }],
    ["confidence above 1", { confidence: 1.2 }],
    ["timestamp without offset", { created_at: "2026-10-11 06:48:00" }],
    ["malformed ai_analysis", { ai_analysis: { category: "plastic" } }],
  ])("rejects %s", (_label, overrides) => {
    expect(reportSchema.safeParse(reportRow(overrides)).success).toBe(false);
  });
});

describe("listReportsQuerySchema", () => {
  it("applies defaults", () => {
    expect(listReportsQuerySchema.parse({})).toEqual({ limit: 500, offset: 0 });
  });

  it("coerces numeric strings from the query string", () => {
    expect(listReportsQuerySchema.parse({ limit: "25", offset: "50", status: "resolved" })).toEqual({
      limit: 25,
      offset: 50,
      status: "resolved",
    });
  });
});

describe("classificationResultSchema", () => {
  it("rejects confidence outside 0-1", () => {
    const result = classificationResultSchema.safeParse({
      is_garbage: true,
      category: "plastic",
      confidence: 1.5,
      description: "x",
      severity: "low",
    });
    expect(result.success).toBe(false);
  });
});

describe("createReportFieldsSchema", () => {
  it("coerces form-data coordinates", () => {
    expect(createReportFieldsSchema.parse({ latitude: "19.07", longitude: "72.87" })).toEqual({
      latitude: 19.07,
      longitude: 72.87,
    });
  });
});

describe("imageFileSchema", () => {
  it("accepts a JPEG and rejects a GIF", () => {
    const bytes = new Uint8Array(10);
    expect(imageFileSchema.safeParse(new File([bytes], "a.jpg", { type: "image/jpeg" })).success).toBe(true);
    expect(imageFileSchema.safeParse(new File([bytes], "a.gif", { type: "image/gif" })).success).toBe(false);
  });
});
