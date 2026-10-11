import "server-only";
import { classifyImage } from "@/lib/ai/classify-image";
import { ConfigError, getGeminiEnv, getSupabaseEnv } from "@/lib/env";
import type { AcceptedImageType } from "@/lib/image-type";
import { insertReport, parseReport, type NewReport } from "@/lib/reports/repository";
import { removeReportImage, reportImagePath, uploadReportImage } from "@/lib/reports/storage";
import type { ClassifyResponse, CreateReportFields, Report } from "@/types/reports";

export type SubmitReportInput = {
  bytes: Uint8Array;
  mimeType: AcceptedImageType;
  fields: CreateReportFields;
};

export type SubmitReportResult =
  | { kind: "created"; report: Report }
  | { kind: "rejected"; outcome: "not_garbage" | "uncertain" };

/** Fails before any paid or stateful call when either integration is unconfigured. */
function assertConfigured() {
  const missing: string[] = [];
  for (const read of [getSupabaseEnv, getGeminiEnv]) {
    try {
      read();
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      missing.push(...error.missing);
    }
  }
  if (missing.length > 0) throw new ConfigError(missing);
}

type AcceptedClassification = Pick<NewReport, "category" | "confidence" | "ai_analysis"> & {
  aiDescription: string;
};

function acceptClassification(result: ClassifyResponse): AcceptedClassification | null {
  switch (result.outcome) {
    case "garbage":
      return {
        category: result.classification.category,
        confidence: result.classification.confidence,
        ai_analysis: result.classification,
        aiDescription: result.classification.description,
      };
    case "unclear_category":
      // `ai_analysis` must be a full ClassificationResult (category + severity), which
      // this outcome doesn't have; confidence and description are kept in their columns.
      return {
        category: "other",
        confidence: result.confidence,
        ai_analysis: null,
        aiDescription: result.description,
      };
    default:
      return null;
  }
}

/**
 * Classify → upload → insert. Rejected photos are neither uploaded nor saved.
 * If the insert fails, the uploaded image is removed (best effort).
 */
export async function submitReport({ bytes, mimeType, fields }: SubmitReportInput): Promise<SubmitReportResult> {
  assertConfigured();

  const result = await classifyImage({ bytes, mimeType });
  const accepted = acceptClassification(result);
  if (!accepted) {
    return { kind: "rejected", outcome: result.outcome as "not_garbage" | "uncertain" };
  }

  const id = crypto.randomUUID();
  const path = reportImagePath(id, mimeType);
  const imageUrl = await uploadReportImage(path, bytes, mimeType);

  let row: unknown;
  try {
    row = await insertReport({
      id,
      image_url: imageUrl,
      latitude: fields.latitude,
      longitude: fields.longitude,
      category: accepted.category,
      description: fields.description || accepted.aiDescription,
      confidence: accepted.confidence,
      ai_analysis: accepted.ai_analysis,
    });
  } catch (error) {
    await removeReportImage(path);
    throw error;
  }

  // The row exists at this point, so a contract mismatch must not delete its image.
  return { kind: "created", report: parseReport(row) };
}
