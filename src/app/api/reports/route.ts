import type { NextRequest } from "next/server";
import { apiError, handleUnknownError, validationError } from "@/lib/api-error";
import { readImageUpload } from "@/lib/image-upload";
import { listReports } from "@/lib/reports/repository";
import { submitReport } from "@/lib/reports/submit-report";
import { createReportFieldsSchema, listReportsQuerySchema } from "@/lib/validation/reports";
import type { CreateReportResponse, ListReportsResponse } from "@/types/reports";

export async function GET(request: NextRequest) {
  const parsed = listReportsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return validationError("Invalid query parameters", parsed.error);
  }

  try {
    const { reports, hasMore } = await listReports(parsed.data);
    const body: ListReportsResponse = {
      reports,
      pagination: {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        has_more: hasMore,
      },
    };
    return Response.json(body);
  } catch (error) {
    return handleUnknownError(error);
  }
}

const REJECTION_MESSAGES = {
  not_garbage: "This photo doesn't appear to show garbage. Upload a photo that clearly shows the garbage.",
  uncertain: "We couldn't tell what this photo shows. Upload a clearer, well-lit photo of the garbage.",
} as const;

export async function POST(request: NextRequest) {
  const upload = await readImageUpload(request);
  if (!upload.ok) return upload.response;
  const { form, bytes, mimeType } = upload.upload;

  // Only these fields are read; anything else the client sends (category, status, …) is ignored.
  const fields = createReportFieldsSchema.safeParse({
    latitude: form.get("latitude") ?? undefined,
    longitude: form.get("longitude") ?? undefined,
    description: form.get("description") ?? undefined,
  });
  if (!fields.success) {
    return validationError("Invalid report fields", fields.error);
  }

  try {
    const result = await submitReport({ bytes, mimeType, fields: fields.data });
    if (result.kind === "rejected") {
      return apiError("VALIDATION_ERROR", REJECTION_MESSAGES[result.outcome], 422, {
        outcome: result.outcome,
      });
    }
    const body: CreateReportResponse = { report: result.report };
    return Response.json(body, { status: 201 });
  } catch (error) {
    return handleUnknownError(error);
  }
}
