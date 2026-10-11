import { ApiError } from "@google/genai";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/classify/route";
import { detectImageType } from "@/lib/image-type";
import { MAX_IMAGE_BYTES, REPORT_CATEGORIES, classifyResponseSchema } from "@/lib/validation/reports";

// All model calls are mocked: no API key, network, or paid usage is involved.
const generateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent };
    },
  };
});

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x10, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function imageFile(signature: number[], type: string, size = 64, name = "photo") {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return new File([bytes], name, { type });
}

async function multipartRequest(form: FormData, headers: Record<string, string | null> = {}) {
  const encoded = new Response(form);
  const body = new Uint8Array(await encoded.arrayBuffer());
  const allHeaders: Record<string, string> = {
    "content-type": encoded.headers.get("content-type")!,
    "content-length": String(body.length),
  };
  for (const [key, value] of Object.entries(headers)) {
    if (value === null) delete allHeaders[key];
    else allHeaders[key] = value;
  }
  return new NextRequest("http://localhost/api/classify", { method: "POST", body, headers: allHeaders });
}

async function classify(file: File | string | null) {
  const form = new FormData();
  if (file !== null) form.set("image", file);
  return POST(await multipartRequest(form));
}

function modelReturns(output: unknown) {
  generateContent.mockResolvedValue({ text: typeof output === "string" ? output : JSON.stringify(output) });
}

const garbage = (overrides: Record<string, unknown> = {}) => ({
  verdict: "garbage",
  category: "plastic",
  severity: "medium",
  confidence: 0.9,
  description: "A pile of plastic bottles and bags beside a wall.",
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "gemma-test-model");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  generateContent.mockReset();
});

describe("POST /api/classify: input validation", () => {
  it("rejects a request without an image", async () => {
    const res = await classify(null);

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects a text field instead of a file", async () => {
    const res = await classify("not a file");

    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects a disallowed MIME type", async () => {
    const res = await classify(imageFile([0x47, 0x49, 0x46, 0x38], "image/gif"));

    expect(res.status).toBe(400);
    expect((await res.json()).error.details.formErrors).toContain("Image must be JPEG, PNG, or WebP");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects content that does not match an allowed image signature", async () => {
    const res = await classify(new File(["<html>not an image</html>"], "x.png", { type: "image/png" }));

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("File content is not a valid JPEG, PNG, or WebP image");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects content whose real type differs from the declared type", async () => {
    const res = await classify(imageFile(PNG, "image/jpeg"));

    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects an image just over 4 MB with 413", async () => {
    const res = await classify(imageFile(JPEG, "image/jpeg", MAX_IMAGE_BYTES + 1));

    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("rejects an oversized body from Content-Length before reading it", async () => {
    const form = new FormData();
    form.set("image", imageFile(JPEG, "image/jpeg"));
    const req = await multipartRequest(form, { "content-length": String(MAX_IMAGE_BYTES + 128 * 1024) });
    const formData = vi.spyOn(req, "formData");

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });

  it("requires a Content-Length header", async () => {
    const form = new FormData();
    form.set("image", imageFile(JPEG, "image/jpeg"));

    const res = await POST(await multipartRequest(form, { "content-length": null }));

    expect(res.status).toBe(411);
  });

  it("rejects non-multipart requests with 415", async () => {
    const req = new NextRequest("http://localhost/api/classify", {
      method: "POST",
      body: JSON.stringify({ image: "data" }),
      headers: { "content-type": "application/json", "content-length": "17" },
    });

    expect((await POST(req)).status).toBe(415);
  });

  it("rejects malformed multipart bodies", async () => {
    const body = "this is not multipart";
    const req = new NextRequest("http://localhost/api/classify", {
      method: "POST",
      body,
      headers: { "content-type": "multipart/form-data; boundary=xyz", "content-length": String(body.length) },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("Request body is not valid multipart form data");
  });
});

describe("POST /api/classify: classification outcomes", () => {
  it("classifies garbage and sends the image to the configured model", async () => {
    modelReturns(garbage());

    const res = await classify(imageFile(JPEG, "image/jpeg"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      outcome: "garbage",
      classification: {
        is_garbage: true,
        category: "plastic",
        severity: "medium",
        confidence: 0.9,
        description: "A pile of plastic bottles and bags beside a wall.",
      },
    });
    expect(classifyResponseSchema.safeParse(body).success).toBe(true);

    const [call] = generateContent.mock.calls[0];
    expect(call.model).toBe("gemma-test-model");
    expect(call.contents[0].parts[0].inlineData.mimeType).toBe("image/jpeg");
    expect(Buffer.from(call.contents[0].parts[0].inlineData.data, "base64").subarray(0, 4)).toEqual(
      Buffer.from(JPEG),
    );
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it.each(REPORT_CATEGORIES)("returns category %s", async (category) => {
    modelReturns(garbage({ category }));

    const body = await (await classify(imageFile(PNG, "image/png"))).json();

    expect(body.outcome).toBe("garbage");
    expect(body.classification.category).toBe(category);
  });

  it("accepts WebP images", async () => {
    modelReturns(garbage());

    expect((await classify(imageFile(WEBP, "image/webp"))).status).toBe(200);
  });

  it("returns unclear_category when garbage type cannot be determined", async () => {
    modelReturns(garbage({ category: "unclear", severity: null, confidence: 0.8 }));

    expect(await (await classify(imageFile(JPEG, "image/jpeg"))).json()).toEqual({
      outcome: "unclear_category",
      confidence: 0.8,
      description: "A pile of plastic bottles and bags beside a wall.",
    });
  });

  it("returns not_garbage for a photo without waste", async () => {
    modelReturns({
      verdict: "not_garbage",
      category: null,
      severity: null,
      confidence: 0.95,
      description: "A clean street with parked scooters.",
    });

    const body = await (await classify(imageFile(JPEG, "image/jpeg"))).json();

    expect(body).toEqual({ outcome: "not_garbage", confidence: 0.95, description: "A clean street with parked scooters." });
  });

  it("returns uncertain when the model says so", async () => {
    modelReturns({ verdict: "uncertain", category: null, severity: null, confidence: 0.3, description: "Too dark to tell." });

    expect((await (await classify(imageFile(JPEG, "image/jpeg"))).json()).outcome).toBe("uncertain");
  });

  it("downgrades a low-confidence garbage verdict to uncertain", async () => {
    modelReturns(garbage({ confidence: 0.4 }));

    const body = await (await classify(imageFile(JPEG, "image/jpeg"))).json();

    expect(body.outcome).toBe("uncertain");
    expect(body).not.toHaveProperty("classification");
  });

  it("accepts JSON wrapped in a markdown fence", async () => {
    modelReturns("```json\n" + JSON.stringify(garbage({ category: "organic" })) + "\n```");

    const body = await (await classify(imageFile(JPEG, "image/jpeg"))).json();

    expect(body.classification.category).toBe("organic");
  });
});

describe("POST /api/classify: invalid model output", () => {
  it.each([
    ["malformed JSON", '{"verdict": "garbage", '],
    ["no JSON at all", "I think this is garbage."],
    ["empty text", ""],
    ["unknown category", garbage({ category: "glass" })],
    ["confidence above 1", garbage({ confidence: 1.5 })],
    ["negative confidence", garbage({ confidence: -0.1 })],
    ["confidence as string", garbage({ confidence: "0.9" })],
    ["unknown verdict", garbage({ verdict: "maybe" })],
    ["garbage without category", garbage({ category: null })],
    ["known category without severity", garbage({ severity: null })],
    ["empty description", garbage({ description: "  " })],
  ])("returns 502 AI_INVALID_RESPONSE for %s", async (_label, output) => {
    modelReturns(output);

    const res = await classify(imageFile(JPEG, "image/jpeg"));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "AI_INVALID_RESPONSE",
        message: "The AI returned an unusable result. Try again or use a different photo.",
      },
    });
  });

  it("returns 502 when the model returns no text (e.g. blocked)", async () => {
    generateContent.mockResolvedValue({ text: undefined });

    expect((await classify(imageFile(JPEG, "image/jpeg"))).status).toBe(502);
  });
});

describe("POST /api/classify: configuration and provider failures", () => {
  it("returns 503 CONFIG_MISSING without calling the model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_MODEL", "");

    const res = await classify(imageFile(JPEG, "image/jpeg"));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: {
        code: "CONFIG_MISSING",
        message: "Server is missing required configuration",
        details: { missing: ["GEMINI_API_KEY", "GEMINI_MODEL"] },
      },
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it.each([
    [429, "Resource exhausted", 503, "The AI service is busy. Try again shortly."],
    [401, "Unauthorized", 502, "The AI provider rejected the server's credentials."],
    [400, '{"error":{"message":"API key not valid. Please pass a valid API key."}}', 502, "The AI provider rejected the server's credentials."],
    [404, "models/gemma-test-model is not found", 502, "The configured AI model was not found. Check GEMINI_MODEL."],
    [400, "Image input modality is not enabled for models/gemma-test-model", 502, "The configured AI model cannot read images. Set GEMINI_MODEL to an image-capable model."],
    [500, "Internal error", 502, "The AI service is unavailable. Try again later."],
  ])("maps provider HTTP %i to a safe AI_UNAVAILABLE response", async (status, providerMessage, httpStatus, message) => {
    generateContent.mockRejectedValue(new ApiError({ status, message: providerMessage }));

    const res = await classify(imageFile(JPEG, "image/jpeg"));

    expect(res.status).toBe(httpStatus);
    expect(await res.json()).toEqual({ error: { code: "AI_UNAVAILABLE", message } });
  });

  it("maps network failures to 502 AI_UNAVAILABLE", async () => {
    generateContent.mockRejectedValue(new TypeError("fetch failed"));

    expect((await classify(imageFile(JPEG, "image/jpeg"))).status).toBe(502);
  });

  it("never leaks provider messages or keys to the client, but logs them server-side", async () => {
    vi.stubEnv("GEMINI_API_KEY", "sk-very-secret-value");
    generateContent.mockRejectedValue(
      new ApiError({ status: 500, message: "upstream trace at 10.1.2.3 key=sk-very-secret-value" }),
    );

    const res = await classify(imageFile(JPEG, "image/jpeg"));
    const text = await res.text();

    expect(text).not.toContain("sk-very-secret-value");
    expect(text).not.toContain("10.1.2.3");
    expect(text).not.toContain("stack");
    expect(console.error).toHaveBeenCalled();
  });

  it("falls back to prompt-only JSON when the model rejects JSON mode, and remembers it", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemma-no-json-mode");
    generateContent
      .mockRejectedValueOnce(new ApiError({ status: 400, message: "JSON mode is not enabled for models/gemma-no-json-mode" }))
      .mockResolvedValue({ text: JSON.stringify(garbage()) });

    const first = await classify(imageFile(JPEG, "image/jpeg"));
    expect(first.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[0][0].config.responseMimeType).toBe("application/json");
    expect(generateContent.mock.calls[1][0].config.responseMimeType).toBeUndefined();

    generateContent.mockClear();
    const second = await classify(imageFile(JPEG, "image/jpeg"));
    expect(second.status).toBe(200);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].config.responseMimeType).toBeUndefined();
  });
});

describe("detectImageType", () => {
  it.each([
    [JPEG, "image/jpeg"],
    [PNG, "image/png"],
    [WEBP, "image/webp"],
    [[0x47, 0x49, 0x46, 0x38], null],
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20], null],
  ])("detects %j as %s", (signature, expected) => {
    const bytes = new Uint8Array(16);
    bytes.set(signature);
    expect(detectImageType(bytes)).toBe(expected);
  });
});
