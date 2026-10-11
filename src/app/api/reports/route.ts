import type { NextRequest } from "next/server";
import { handleUnknownError, validationError } from "@/lib/api-error";
import { listReports } from "@/lib/reports/repository";
import { listReportsQuerySchema } from "@/lib/validation/reports";
import type { ListReportsResponse } from "@/types/reports";

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
