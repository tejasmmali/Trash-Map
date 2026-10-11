import type { NextRequest } from "next/server";
import { apiError, handleUnknownError, validationError } from "@/lib/api-error";
import { updateReportStatus } from "@/lib/reports/repository";
import { reportIdSchema, updateReportStatusSchema } from "@/lib/validation/reports";
import type { UpdateReportResponse } from "@/types/reports";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  const parsedId = reportIdSchema.safeParse(id);
  if (!parsedId.success) {
    return validationError("Report id must be a UUID", parsedId.error);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }

  const parsedBody = updateReportStatusSchema.safeParse(json);
  if (!parsedBody.success) {
    return validationError("Invalid request body", parsedBody.error);
  }

  try {
    const report = await updateReportStatus(parsedId.data, parsedBody.data.status);
    if (!report) {
      return apiError("NOT_FOUND", "Report not found", 404);
    }
    const body: UpdateReportResponse = { report };
    return Response.json(body);
  } catch (error) {
    return handleUnknownError(error);
  }
}
