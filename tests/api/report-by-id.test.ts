import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/reports/[id]/route";
import { ConfigError } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createFakeSupabase, methodCalls, type QueryResult } from "../helpers/fake-supabase";
import { REPORT_ID, reportRow } from "../helpers/fixtures";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: vi.fn() }));

const NOW = new Date("2026-10-11T07:30:00.000Z");

function useDatabase(...results: QueryResult[]) {
  const fake = createFakeSupabase(results);
  vi.mocked(getSupabaseAdmin).mockReturnValue(fake.client);
  return fake;
}

function patch(id: string, body: unknown) {
  const request = new NextRequest(`http://localhost/api/reports/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PATCH(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("PATCH /api/reports/[id]", () => {
  describe("validation", () => {
    it("rejects a non-UUID id", async () => {
      const res = await patch("not-a-uuid", { status: "resolved" });

      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it("rejects a body that is not JSON", async () => {
      const res = await patch(REPORT_ID, "{status:");

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON" },
      });
    });

    it.each([
      ["unknown status", { status: "done" }],
      ["missing status", {}],
      ["non-object body", ["resolved"]],
    ])("rejects %s", async (_label, body) => {
      const res = await patch(REPORT_ID, body);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });
  });

  describe("resolving", () => {
    it("sets status and resolved_at, only updating unresolved rows", async () => {
      const updated = reportRow({ status: "resolved", resolved_at: NOW.toISOString() });
      const fake = useDatabase({ data: updated, error: null });

      const res = await patch(REPORT_ID, { status: "resolved" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ report: updated });
      const [query] = fake.queries;
      expect(methodCalls(query, "update")).toEqual([
        [{ status: "resolved", resolved_at: NOW.toISOString() }],
      ]);
      expect(methodCalls(query, "eq")).toEqual([["id", REPORT_ID]]);
      expect(methodCalls(query, "neq")).toEqual([["status", "resolved"]]);
    });

    it("keeps the original resolved_at when the report is already resolved", async () => {
      const original = reportRow({
        status: "resolved",
        resolved_at: "2026-10-01T10:00:00+00:00",
      });
      const fake = useDatabase({ data: null, error: null }, { data: original, error: null });

      const res = await patch(REPORT_ID, { status: "resolved" });

      expect(res.status).toBe(200);
      expect((await res.json()).report.resolved_at).toBe("2026-10-01T10:00:00+00:00");
      expect(fake.queries).toHaveLength(2);
      expect(methodCalls(fake.queries[1], "update")).toEqual([]);
    });

    it("returns 404 when the report does not exist", async () => {
      useDatabase({ data: null, error: null }, { data: null, error: null });

      const res = await patch(REPORT_ID, { status: "resolved" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Report not found" },
      });
    });
  });

  describe("reopening or progressing", () => {
    it.each(["pending", "in_progress"] as const)("sets %s and clears resolved_at", async (status) => {
      const updated = reportRow({ status, resolved_at: null });
      const fake = useDatabase({ data: updated, error: null });

      const res = await patch(REPORT_ID, { status });

      expect(res.status).toBe(200);
      expect((await res.json()).report).toEqual(updated);
      expect(methodCalls(fake.queries[0], "update")).toEqual([[{ status, resolved_at: null }]]);
      expect(methodCalls(fake.queries[0], "neq")).toEqual([]);
    });

    it("returns 404 when the report does not exist", async () => {
      useDatabase({ data: null, error: null });

      const res = await patch(REPORT_ID, { status: "pending" });

      expect(res.status).toBe(404);
    });
  });

  describe("failures", () => {
    it("returns 503 CONFIG_MISSING when Supabase is not configured", async () => {
      vi.mocked(getSupabaseAdmin).mockImplementation(() => {
        throw new ConfigError(["SUPABASE_SERVICE_ROLE_KEY"]);
      });

      const res = await patch(REPORT_ID, { status: "resolved" });

      expect(res.status).toBe(503);
      expect((await res.json()).error.details).toEqual({ missing: ["SUPABASE_SERVICE_ROLE_KEY"] });
    });

    it("returns 500 DATABASE_ERROR when the update fails", async () => {
      useDatabase({ data: null, error: { message: "timeout", code: "57014" } });

      const res = await patch(REPORT_ID, { status: "in_progress" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: { code: "DATABASE_ERROR", message: "Database request failed" },
      });
    });

    it("returns 500 DATABASE_ERROR when the follow-up lookup fails", async () => {
      useDatabase({ data: null, error: null }, { data: null, error: { message: "boom" } });

      const res = await patch(REPORT_ID, { status: "resolved" });

      expect(res.status).toBe(500);
      expect((await res.json()).error.code).toBe("DATABASE_ERROR");
    });
  });
});
