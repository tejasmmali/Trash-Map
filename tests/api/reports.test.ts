import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/reports/route";
import { ConfigError } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createFakeSupabase, methodCalls, type QueryResult } from "../helpers/fake-supabase";
import { REPORT_ID, reportRow } from "../helpers/fixtures";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: vi.fn() }));

function useDatabase(...results: QueryResult[]) {
  const fake = createFakeSupabase(results);
  vi.mocked(getSupabaseAdmin).mockReturnValue(fake.client);
  return fake;
}

function get(query = "") {
  return GET(new NextRequest(`http://localhost/api/reports${query}`));
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/reports", () => {
  it("returns reports newest first with default pagination", async () => {
    const fake = useDatabase({ data: [reportRow()], error: null });

    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      reports: [reportRow()],
      pagination: { limit: 500, offset: 0, has_more: false },
    });
    const [query] = fake.queries;
    expect(methodCalls(query, "from")).toEqual([["reports"]]);
    expect(methodCalls(query, "order")[0]).toEqual(["created_at", { ascending: false }]);
    expect(methodCalls(query, "range")).toEqual([[0, 500]]);
    expect(methodCalls(query, "eq")).toEqual([]);
  });

  it("applies status and category filters", async () => {
    const fake = useDatabase({ data: [], error: null });

    const res = await get("?status=pending&category=plastic");

    expect(res.status).toBe(200);
    expect(methodCalls(fake.queries[0], "eq")).toEqual([
      ["status", "pending"],
      ["category", "plastic"],
    ]);
  });

  it("fetches one extra row to report has_more and trims it from the page", async () => {
    const rows = [
      reportRow(),
      reportRow({ id: "11111111-1111-4111-8111-111111111111" }),
      reportRow({ id: "22222222-2222-4222-8222-222222222222" }),
    ];
    const fake = useDatabase({ data: rows, error: null });

    const res = await get("?limit=2&offset=4");
    const body = await res.json();

    expect(methodCalls(fake.queries[0], "range")).toEqual([[4, 6]]);
    expect(body.reports).toHaveLength(2);
    expect(body.pagination).toEqual({ limit: 2, offset: 4, has_more: true });
  });

  it.each([
    ["unknown status", "?status=done"],
    ["unknown category", "?category=glass"],
    ["limit above max", "?limit=501"],
    ["zero limit", "?limit=0"],
    ["non-numeric limit", "?limit=abc"],
    ["fractional limit", "?limit=2.5"],
    ["negative offset", "?offset=-1"],
  ])("rejects %s with 400 without touching the database", async (_label, query) => {
    const res = await get(query);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.fieldErrors).toBeDefined();
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 CONFIG_MISSING with variable names only", async () => {
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new ConfigError(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
    });

    const res = await get();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: {
        code: "CONFIG_MISSING",
        message: "Server is missing required configuration",
        details: { missing: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
      },
    });
  });

  it("returns 500 DATABASE_ERROR without leaking the driver message", async () => {
    useDatabase({ data: null, error: { message: "connection refused at 10.0.0.5", code: "08006" } });

    const res = await get();
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: { code: "DATABASE_ERROR", message: "Database request failed" },
    });
    expect(text).not.toContain("10.0.0.5");
  });

  it("returns 500 DATABASE_ERROR when a row breaks the Report contract", async () => {
    useDatabase({ data: [reportRow({ id: REPORT_ID, category: "glass" })], error: null });

    const res = await get();

    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("DATABASE_ERROR");
  });
});
