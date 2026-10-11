import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/reports";
import type { ListReportsQuery, Report, ReportStatus } from "@/types/reports";

export class DatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseError";
  }
}

const REPORT_COLUMNS =
  "id,image_url,latitude,longitude,category,description,confidence,status,created_at,resolved_at,ai_analysis,is_sample";

type QueryResult = { data: unknown; error: unknown };

function unwrap(result: QueryResult, action: string): unknown {
  if (result.error) {
    throw new DatabaseError(`Failed to ${action}`, { cause: result.error });
  }
  return result.data;
}

export function parseReport(row: unknown): Report {
  const parsed = reportSchema.safeParse(row);
  if (!parsed.success) {
    throw new DatabaseError("Report row does not match the Report contract", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export async function listReports(
  query: ListReportsQuery,
): Promise<{ reports: Report[]; hasMore: boolean }> {
  let builder = getSupabaseAdmin()
    .from("reports")
    .select(REPORT_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    // Inclusive range: one extra row tells us whether another page exists.
    .range(query.offset, query.offset + query.limit);

  if (query.status) builder = builder.eq("status", query.status);
  if (query.category) builder = builder.eq("category", query.category);

  const rows = unwrap(await builder, "list reports");
  if (!Array.isArray(rows)) {
    throw new DatabaseError("Unexpected response when listing reports");
  }

  return {
    reports: rows.slice(0, query.limit).map(parseReport),
    hasMore: rows.length > query.limit,
  };
}

export type NewReport = Pick<
  Report,
  "id" | "image_url" | "latitude" | "longitude" | "category" | "description" | "confidence" | "ai_analysis"
>;

/**
 * Inserts a pending, non-sample report and returns the raw row. Throws
 * DatabaseError only when the insert itself failed (no row was written).
 */
export async function insertReport(report: NewReport): Promise<unknown> {
  return unwrap(
    await getSupabaseAdmin()
      .from("reports")
      .insert({ ...report, status: "pending", resolved_at: null, is_sample: false })
      .select(REPORT_COLUMNS)
      .single(),
    "insert report",
  );
}

/**
 * Sets the status and keeps `resolved_at` consistent with it. Re-resolving an
 * already resolved report keeps its original `resolved_at`.
 * Returns null when no report has the given id.
 */
export async function updateReportStatus(
  id: string,
  status: ReportStatus,
): Promise<Report | null> {
  const reports = () => getSupabaseAdmin().from("reports");

  if (status !== "resolved") {
    const row = unwrap(
      await reports()
        .update({ status, resolved_at: null })
        .eq("id", id)
        .select(REPORT_COLUMNS)
        .maybeSingle(),
      "update report status",
    );
    return row ? parseReport(row) : null;
  }

  const resolved = unwrap(
    await reports()
      .update({ status, resolved_at: new Date().toISOString() })
      .eq("id", id)
      .neq("status", "resolved")
      .select(REPORT_COLUMNS)
      .maybeSingle(),
    "resolve report",
  );
  if (resolved) return parseReport(resolved);

  // Nothing updated: either the report is already resolved or it doesn't exist.
  const existing = unwrap(
    await reports().select(REPORT_COLUMNS).eq("id", id).maybeSingle(),
    "load report",
  );
  return existing ? parseReport(existing) : null;
}
