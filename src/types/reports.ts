import type { z } from "zod";
import type {
  classificationResultSchema,
  complaintDraftRequestSchema,
  complaintDraftSchema,
  createReportFieldsSchema,
  listReportsQuerySchema,
  reportCategorySchema,
  reportSchema,
  reportStatusSchema,
  severitySchema,
  updateReportStatusSchema,
} from "@/lib/validation/reports";
import type { apiErrorCodeSchema, apiErrorSchema } from "@/lib/validation/api";

// Types are inferred from the Zod schemas so the runtime validation and the
// compile-time contract cannot drift apart.

export type ReportCategory = z.infer<typeof reportCategorySchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;

export type Report = z.infer<typeof reportSchema>;
export type ClassificationResult = z.infer<typeof classificationResultSchema>;

export type CreateReportFields = z.infer<typeof createReportFieldsSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type UpdateReportStatusRequest = z.infer<typeof updateReportStatusSchema>;

export type ComplaintDraftRequest = z.infer<typeof complaintDraftRequestSchema>;
export type ComplaintDraft = z.infer<typeof complaintDraftSchema>;

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export type ListReportsResponse = { reports: Report[] };
export type CreateReportResponse = { report: Report };
export type UpdateReportResponse = { report: Report };
export type ClassifyResponse = { classification: ClassificationResult };
export type ComplaintDraftResponse = { draft: ComplaintDraft };
