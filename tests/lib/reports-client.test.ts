import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_REPORTS } from "@/lib/demo-reports";
import {
  applyDemoStatus,
  fetchReports,
  filterReports,
  summarizeReports,
  updateReportStatus,
} from "@/lib/reports-client";
import { reportSchema } from "@/lib/validation/reports";
import { REPORT_ID, reportRow } from "../helpers/fixtures";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () =>
    typeof body === "string"
      ? new Response(body, { status })
      : Response.json(body, { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchReports", () => {
  it("builds the query string from filters and offset", async () => {
    const fetchMock = mockFetch(200, {
      reports: [],
      pagination: { limit: 500, offset: 500, has_more: false },
    });

    await fetchReports({ status: "pending", category: "plastic" }, 500);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reports?status=pending&category=plastic&offset=500",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("omits the query string when there are no filters", async () => {
    const fetchMock = mockFetch(200, { reports: [], pagination: { limit: 500, offset: 0, has_more: false } });

    await fetchReports({});

    expect(fetchMock).toHaveBeenCalledWith("/api/reports", expect.anything());
  });

  it("returns validated reports and pagination", async () => {
    mockFetch(200, { reports: [reportRow()], pagination: { limit: 500, offset: 0, has_more: true } });

    const result = await fetchReports({});

    expect(result).toEqual({
      kind: "ok",
      reports: [reportRow()],
      pagination: { limit: 500, offset: 0, has_more: true },
    });
  });

  it("maps 503 CONFIG_MISSING to config-missing (demo mode trigger)", async () => {
    mockFetch(503, {
      error: { code: "CONFIG_MISSING", message: "Server is missing required configuration" },
    });

    expect(await fetchReports({})).toEqual({ kind: "config-missing" });
  });

  it("treats other 503s and database errors as errors, not demo mode", async () => {
    mockFetch(503, "Service Unavailable");
    expect((await fetchReports({})).kind).toBe("error");

    mockFetch(500, { error: { code: "DATABASE_ERROR", message: "Database request failed" } });
    expect(await fetchReports({})).toEqual({ kind: "error", message: "Database request failed" });
  });

  it("rejects a malformed success payload", async () => {
    mockFetch(200, { reports: [reportRow({ category: "glass" })], pagination: { limit: 1, offset: 0, has_more: false } });

    expect(await fetchReports({})).toEqual({
      kind: "error",
      message: "The server returned data in an unexpected format.",
    });
  });

  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));

    expect(await fetchReports({})).toEqual({ kind: "error", message: "Could not reach the server." });
  });
});

describe("updateReportStatus", () => {
  it("sends the PATCH contract and returns the server's report", async () => {
    const updated = reportRow({ status: "resolved", resolved_at: "2026-10-11T07:30:00+00:00" });
    const fetchMock = mockFetch(200, { report: updated });

    const result = await updateReportStatus(REPORT_ID, "resolved");

    expect(fetchMock).toHaveBeenCalledWith(`/api/reports/${REPORT_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    expect(result).toEqual({ ok: true, report: updated });
  });

  it("returns a readable message for 404", async () => {
    mockFetch(404, { error: { code: "NOT_FOUND", message: "Report not found" } });

    expect(await updateReportStatus(REPORT_ID, "pending")).toEqual({
      ok: false,
      message: "This report no longer exists.",
    });
  });

  it("falls back to the HTTP status when the error body is not the API shape", async () => {
    mockFetch(502, "Bad Gateway");

    expect(await updateReportStatus(REPORT_ID, "pending")).toEqual({
      ok: false,
      message: "Request failed (HTTP 502).",
    });
  });
});

describe("summarizeReports and filterReports", () => {
  const reports = [
    reportRow({ status: "pending", category: "plastic" }),
    reportRow({ id: "11111111-1111-4111-8111-111111111111", status: "resolved", category: "plastic", resolved_at: "2026-10-10T00:00:00+00:00" }),
    reportRow({ id: "22222222-2222-4222-8222-222222222222", status: "in_progress", category: "organic" }),
  ].map((row) => reportSchema.parse(row));

  it("counts reports by status", () => {
    expect(summarizeReports(reports)).toEqual({ total: 3, pending: 1, in_progress: 1, resolved: 1 });
  });

  it("filters by status and category together", () => {
    expect(filterReports(reports, { category: "plastic" })).toHaveLength(2);
    expect(filterReports(reports, { category: "plastic", status: "resolved" })).toHaveLength(1);
    expect(filterReports(reports, {})).toHaveLength(3);
  });
});

describe("applyDemoStatus", () => {
  const pending = reportSchema.parse(reportRow());
  const now = "2026-10-11T07:30:00.000Z";

  it("sets resolved_at when resolving", () => {
    expect(applyDemoStatus(pending, "resolved", now)).toMatchObject({ status: "resolved", resolved_at: now });
  });

  it("keeps the original resolved_at when already resolved", () => {
    const resolved = { ...pending, status: "resolved" as const, resolved_at: "2026-10-01T00:00:00+00:00" };
    expect(applyDemoStatus(resolved, "resolved", now)).toBe(resolved);
  });

  it("clears resolved_at when reopening", () => {
    const resolved = { ...pending, status: "resolved" as const, resolved_at: "2026-10-01T00:00:00+00:00" };
    expect(applyDemoStatus(resolved, "in_progress", now)).toMatchObject({ status: "in_progress", resolved_at: null });
  });
});

describe("DEMO_REPORTS", () => {
  it("conform to the Report contract and are marked as samples", () => {
    for (const report of DEMO_REPORTS) {
      expect(reportSchema.safeParse(report).success).toBe(true);
      expect(report.is_sample).toBe(true);
      expect(report.description).toMatch(/^\[SAMPLE\]/);
    }
  });
});
