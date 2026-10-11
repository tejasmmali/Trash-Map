import { z } from "zod";

// Shared contract between frontend and backend. Changing anything here is a
// contract change: update PROJECT_CONTEXT.md (section E) and the SQL migration.

export const REPORT_CATEGORIES = [
  "plastic",
  "organic",
  "construction",
  "mixed",
  "other",
] as const;

export const REPORT_STATUSES = ["pending", "in_progress", "resolved"] as const;

export const SEVERITY_LEVELS = ["low", "medium", "high"] as const;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// Vercel Functions cap request bodies at 4.5 MB, so uploads must stay below it.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const reportCategorySchema = z.enum(REPORT_CATEGORIES);
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export const severitySchema = z.enum(SEVERITY_LEVELS);

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/** JSON the model must return; validated before anything is stored. */
export const classificationResultSchema = z.object({
  is_garbage: z.boolean(),
  category: reportCategorySchema,
  confidence: z.number().min(0).max(1),
  description: z.string().trim().min(1).max(500),
  severity: severitySchema,
});

export const reportSchema = z.object({
  id: z.uuid(),
  image_url: z.string().min(1),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  category: reportCategorySchema,
  description: z.string().max(1000).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  status: reportStatusSchema,
  created_at: z.iso.datetime({ offset: true }),
  resolved_at: z.iso.datetime({ offset: true }).nullable(),
  ai_analysis: classificationResultSchema.nullable(),
  is_sample: z.boolean(),
});

/**
 * Text fields of the multipart POST /api/reports body. The `image` file part
 * is validated separately with `imageFileSchema`.
 */
export const createReportFieldsSchema = z.object({
  latitude: z.coerce.number().pipe(latitudeSchema),
  longitude: z.coerce.number().pipe(longitudeSchema),
  description: z.string().trim().max(1000).optional(),
});

export const imageFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Image is empty")
  .refine((file) => file.size <= MAX_IMAGE_BYTES, "Image must be 4 MB or smaller")
  .refine(
    (file) => (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type),
    "Image must be JPEG, PNG, or WebP",
  );

export const listReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
});

export const updateReportStatusSchema = z.object({
  status: reportStatusSchema,
});

export const complaintDraftRequestSchema = z.object({
  report_id: z.uuid(),
});

export const complaintDraftSchema = z.object({
  report_id: z.uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  generated_at: z.iso.datetime({ offset: true }),
});
