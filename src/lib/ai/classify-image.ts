import "server-only";
import { ApiError } from "@google/genai";
import { z } from "zod";
import { getGemini } from "@/lib/ai/gemini";
import { AiInvalidResponseError, AiProviderError, type AiProviderErrorReason } from "@/lib/ai/errors";
import type { AcceptedImageType } from "@/lib/image-type";
import {
  REPORT_CATEGORIES,
  SEVERITY_LEVELS,
  classifyResponseSchema,
  reportCategorySchema,
  severitySchema,
} from "@/lib/validation/reports";
import type { ClassifyResponse } from "@/types/reports";

/** Below this self-reported confidence, garbage / not-garbage verdicts become "uncertain". */
export const MIN_CONFIDENCE = 0.5;

const REQUEST_TIMEOUT_MS = 30_000;

const PROMPT = `You are classifying a single photo submitted to a civic garbage-reporting app in Mumbai, India.

Decide whether the photo shows garbage or litter that should be reported: dumped or accumulated waste, overflowing bins, litter, debris piles. Clean streets, people, animals, food on a plate, products in a shop, or everyday scenes without waste are NOT garbage.

Return ONLY a JSON object, with no markdown and no other text, with exactly these keys:
- "verdict": "garbage" if waste is clearly visible, "not_garbage" if the photo clearly does not show waste, "uncertain" if the photo is too blurry, dark, cropped, or ambiguous to tell.
- "category": when verdict is "garbage", the dominant waste type:
  "plastic" (bags, bottles, wrappers), "organic" (food, vegetable, garden or flower waste),
  "construction" (rubble, cement, tiles, debris), "mixed" (several types with none dominant),
  "other" (clearly garbage but none of the above, e.g. e-waste, textiles, furniture),
  or "unclear" if it is garbage but you cannot tell the type. Use null when verdict is not "garbage".
- "severity": when category is one of the five types, "low" (a few items), "medium" (a pile or overflowing bin), or "high" (large dump, blocking a path or drain). Otherwise null.
- "confidence": your confidence in the verdict, a number from 0 to 1.
- "description": one or two plain sentences describing what is visible (max 300 characters). Do not identify people.

Never label a photo as garbage just because a category is required.`;

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["garbage", "not_garbage", "uncertain"] },
    category: {
      anyOf: [{ type: "string", enum: [...REPORT_CATEGORIES, "unclear"] }, { type: "null" }],
    },
    severity: { anyOf: [{ type: "string", enum: [...SEVERITY_LEVELS] }, { type: "null" }] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    description: { type: "string" },
  },
  required: ["verdict", "category", "severity", "confidence", "description"],
};

const modelOutputSchema = z
  .object({
    verdict: z.enum(["garbage", "not_garbage", "uncertain"]),
    category: z.union([reportCategorySchema, z.literal("unclear")]).nullable(),
    severity: severitySchema.nullable(),
    confidence: z.number().min(0).max(1),
    description: z.string().trim().min(1).max(500),
  })
  .superRefine((value, ctx) => {
    if (value.verdict !== "garbage") return;
    if (value.category === null) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Required when verdict is garbage" });
    } else if (value.category !== "unclear" && value.severity === null) {
      ctx.addIssue({ code: "custom", path: ["severity"], message: "Required for a known category" });
    }
  });

type ModelOutput = z.infer<typeof modelOutputSchema>;

// Models that rejected JSON mode once; later calls skip straight to prompt-only JSON.
const structuredOutputUnsupported = new Set<string>();

export type ClassifyImageInput = { bytes: Uint8Array; mimeType: AcceptedImageType };

export async function classifyImage(input: ClassifyImageInput): Promise<ClassifyResponse> {
  const { ai, model } = getGemini();
  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: input.mimeType, data: Buffer.from(input.bytes).toString("base64") } },
        { text: PROMPT },
      ],
    },
  ];

  const generate = async (structured: boolean) => {
    const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          abortSignal: signal,
          temperature: 0.1,
          maxOutputTokens: 512,
          ...(structured
            ? { responseMimeType: "application/json", responseJsonSchema: RESPONSE_JSON_SCHEMA }
            : {}),
        },
      });
    } catch (error) {
      if (signal.aborted) throw new AiProviderError("timeout", { cause: error });
      throw error;
    }
  };

  let response;
  try {
    if (structuredOutputUnsupported.has(model)) {
      response = await generate(false);
    } else {
      try {
        response = await generate(true);
      } catch (error) {
        if (!isStructuredOutputUnsupported(error)) throw error;
        structuredOutputUnsupported.add(model);
        response = await generate(false);
      }
    }
  } catch (error) {
    throw toProviderError(error);
  }

  return toClassifyResponse(parseModelOutput(response.text));
}

export function parseModelOutput(text: string | undefined): ModelOutput {
  if (!text?.trim()) throw new AiInvalidResponseError("Model returned no text");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) throw new AiInvalidResponseError("Model output contains no JSON object");

  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    throw new AiInvalidResponseError("Model output is not valid JSON", { cause: error });
  }

  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiInvalidResponseError("Model output does not match the classification schema", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function toClassifyResponse(output: ModelOutput): ClassifyResponse {
  const { confidence, description } = output;
  let result: ClassifyResponse;

  if (output.verdict === "uncertain" || confidence < MIN_CONFIDENCE) {
    result = { outcome: "uncertain", confidence, description };
  } else if (output.verdict === "not_garbage") {
    result = { outcome: "not_garbage", confidence, description };
  } else if (output.category === "unclear" || output.category === null || output.severity === null) {
    result = { outcome: "unclear_category", confidence, description };
  } else {
    result = {
      outcome: "garbage",
      classification: {
        is_garbage: true,
        category: output.category,
        confidence,
        description,
        severity: output.severity,
      },
    };
  }

  return classifyResponseSchema.parse(result);
}

function providerMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isStructuredOutputUnsupported(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    /json mode|response_?mime_?type|response_?(json_)?schema|structured output/i.test(error.message)
  );
}

function toProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (!(error instanceof ApiError)) return new AiProviderError("unavailable", { cause: error });

  const message = providerMessage(error);
  let reason: AiProviderErrorReason = "unavailable";
  if (error.status === 401 || error.status === 403 || /api[_ ]key/i.test(message)) reason = "auth";
  else if (error.status === 404) reason = "model_not_found";
  else if (error.status === 429) reason = "rate_limited";
  else if (error.status === 400 && /image|modality|multimodal|vision|inline_?data/i.test(message)) {
    reason = "unsupported_model";
  }
  return new AiProviderError(reason, { cause: error });
}
