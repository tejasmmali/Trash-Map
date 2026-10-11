import { z } from "zod";
import { apiErrorSchema } from "@/lib/validation/api";
import { reportSchema } from "@/lib/validation/reports";
import type { Pagination, Report, ReportCategory, ReportStatus } from "@/types/reports";

// Browser-side helpers for calling the reports API. Responses are validated so
// a malformed payload surfaces as an error instead of broken UI.

export type ReportFilters = {
  status?: ReportStatus;
  category?: ReportCategory;
};

export type FetchReportsResult =
  | { kind: "ok"; reports: Report[]; pagination: Pagination }
  | { kind: "config-missing" }
  | { kind: "error"; message: string };

export type UpdateStatusResult =
  | { ok: true; report: Report }
  | { ok: false; message: string };

const listResponseSchema = z.object({
  reports: z.array(reportSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean(),
  }),
});

const updateResponseSchema = z.object({ report: reportSchema });

const UNEXPECTED_FORMAT = "The server returned data in an unexpected format.";

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function errorMessage(body: unknown, status: number): string {
  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success) return `Request failed (HTTP ${status}).`;
  if (parsed.data.error.code === "NOT_FOUND") return "This report no longer exists.";
  return parsed.data.error.message;
}

export async function fetchReports(
  filters: ReportFilters,
  offset = 0,
  signal?: AbortSignal,
): Promise<FetchReportsResult> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();

  let res: Response;
  try {
    res = await fetch(`/api/reports${query ? `?${query}` : ""}`, { cache: "no-store", signal });
  } catch {
    return { kind: "error", message: "Could not reach the server." };
  }

  const body = await readJson(res);

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    if (res.status === 503 && parsed.success && parsed.data.error.code === "CONFIG_MISSING") {
      return { kind: "config-missing" };
    }
    return { kind: "error", message: errorMessage(body, res.status) };
  }

  const parsed = listResponseSchema.safeParse(body);
  if (!parsed.success) return { kind: "error", message: UNEXPECTED_FORMAT };
  return { kind: "ok", ...parsed.data };
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
): Promise<UpdateStatusResult> {
  let res: Response;
  try {
    res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }

  const body = await readJson(res);
  if (!res.ok) return { ok: false, message: errorMessage(body, res.status) };

  const parsed = updateResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: UNEXPECTED_FORMAT };
  return { ok: true, report: parsed.data.report };
}

export type NewReportInput = {
  image: File;
  latitude: number;
  longitude: number;
  description?: string;
};

export type CreateReportResult =
  | { kind: "created"; report: Report }
  | { kind: "rejected"; message: string }
  | { kind: "config-missing"; message: string }
  | { kind: "error"; message: string };

/**
 * Sends only the photo, coordinates, and description. The server classifies
 * the photo and decides every other field.
 */
export async function createReport(input: NewReportInput, signal?: AbortSignal): Promise<CreateReportResult> {
  const form = new FormData();
  form.set("image", input.image);
  form.set("latitude", String(input.latitude));
  form.set("longitude", String(input.longitude));
  const description = input.description?.trim();
  if (description) form.set("description", description);

  let res: Response;
  try {
    res = await fetch("/api/reports", { method: "POST", body: form, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "error", message: "Could not reach the server." };
  }

  const body = await readJson(res);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const message = errorMessage(body, res.status);
    if (res.status === 422) return { kind: "rejected", message };
    if (res.status === 503 && parsed.success && parsed.data.error.code === "CONFIG_MISSING") {
      return { kind: "config-missing", message: "Saving reports is unavailable: the server isn't fully configured." };
    }
    return { kind: "error", message };
  }

  const parsed = updateResponseSchema.safeParse(body);
  if (!parsed.success) return { kind: "error", message: UNEXPECTED_FORMAT };
  return { kind: "created", report: parsed.data.report };
}

export function filterReports(reports: Report[], filters: ReportFilters): Report[] {
  return reports.filter(
    (report) =>
      (!filters.status || report.status === filters.status) &&
      (!filters.category || report.category === filters.category),
  );
}

export type ReportCounts = Record<ReportStatus | "total", number>;

export function summarizeReports(reports: Report[]): ReportCounts {
  const counts: ReportCounts = { total: reports.length, pending: 0, in_progress: 0, resolved: 0 };
  for (const report of reports) counts[report.status] += 1;
  return counts;
}

/**
 * Demo mode only: mirrors the server's PATCH rules so local state stays
 * consistent. Live mode always uses the report returned by the API.
 */
export function applyDemoStatus(report: Report, status: ReportStatus, now: string): Report {
  if (status !== "resolved") return { ...report, status, resolved_at: null };
  if (report.status === "resolved") return report;
  return { ...report, status, resolved_at: now };
}
