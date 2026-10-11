import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/reports/route";
import { classifyImage } from "@/lib/ai/classify-image";
import { AiInvalidResponseError, AiProviderError } from "@/lib/ai/errors";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { MAX_IMAGE_BYTES, reportSchema } from "@/lib/validation/reports";
import type { ClassifyResponse } from "@/types/reports";
import { createFakeSupabase, methodCalls, type QueryResult } from "../helpers/fake-supabase";
import { reportRow } from "../helpers/fixtures";

// Classification and Supabase are mocked: no API keys, network, or paid usage.
vi.mock("@/lib/ai/classify-image", () => ({ classifyImage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: vi.fn() }));

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PUBLIC_BASE = "https://example.supabase.co/storage/v1/object/public/report-images/";
const UUID_PATH = /^reports\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const GARBAGE: ClassifyResponse = {
  outcome: "garbage",
  classification: {
    is_garbage: true,
    category: "plastic",
    confidence: 0.9,
    description: "Plastic bags piled beside a wall.",
    severity: "medium",
  },
};

function imageFile(signature: number[], type: string, size = 64) {
  const bytes = new Uint8Array(size);
  bytes.set(signature);
  return new File([bytes], "../../etc/passwd.jpg", { type });
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
  return new NextRequest("http://localhost/api/reports", { method: "POST", body, headers: allHeaders });
}

type Fields = Record<string, string | File | null>;

async function submit(fields: Fields = {}) {
  const form = new FormData();
  const all: Fields = {
    image: imageFile(JPEG, "image/jpeg"),
    latitude: "19.0178",
    longitude: "72.8478",
    ...fields,
  };
  for (const [key, value] of Object.entries(all)) if (value !== null) form.set(key, value);
  return POST(await multipartRequest(form));
}

function useSupabase(
  results: QueryResult[],
  storage: { uploadError?: unknown; removeError?: unknown; removeThrows?: boolean } = {},
) {
  const fake = createFakeSupabase(results);
  const bucket = {
    upload: vi.fn(async (path: string) =>
      storage.uploadError ? { data: null, error: storage.uploadError } : { data: { path }, error: null },
    ),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: PUBLIC_BASE + path } })),
    remove: vi.fn(async () => {
      if (storage.removeThrows) throw new Error("socket hang up at 10.9.8.7");
      return storage.removeError ? { data: null, error: storage.removeError } : { data: [], error: null };
    }),
  };
  const storageFrom = vi.fn(() => bucket);
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    from: fake.client.from,
    storage: { from: storageFrom },
  } as unknown as SupabaseClient);
  return { ...fake, bucket, storageFrom };
}

/** Echoes the inserted values back the way PostgREST would. */
function insertedRow(overrides: Record<string, unknown> = {}) {
  return reportRow({
    image_url: PUBLIC_BASE + "reports/x.jpg",
    category: "plastic",
    description: GARBAGE.outcome === "garbage" ? GARBAGE.classification.description : null,
    confidence: 0.9,
    ai_analysis: GARBAGE.outcome === "garbage" ? GARBAGE.classification : null,
    is_sample: false,
    created_at: "2026-10-11T09:00:00.123456+00:00",
    ...overrides,
  });
}

function insertCall(fake: ReturnType<typeof useSupabase>) {
  return methodCalls(fake.queries[0], "insert")[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test-not-real");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "report-images");
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "gemma-test-model");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(classifyImage).mockResolvedValue(GARBAGE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/reports", () => {
  describe("accepted photos", () => {
    it("classifies, uploads, inserts, and returns 201 with a contract-valid report", async () => {
      const fake = useSupabase([{ data: insertedRow(), error: null }]);

      const res = await submit({ category: "organic", status: "resolved", is_sample: "true", image_url: "x" });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(reportSchema.safeParse(body.report).success).toBe(true);
      expect(Object.keys(body)).toEqual(["report"]);

      expect(classifyImage).toHaveBeenCalledWith({ bytes: expect.any(Uint8Array), mimeType: "image/jpeg" });

      expect(fake.storageFrom).toHaveBeenCalledWith("report-images");
      const [path, bytes, options] = fake.bucket.upload.mock.calls[0] as unknown as [string, Uint8Array, object];
      expect(path).toMatch(UUID_PATH);
      expect(path.endsWith(".jpg")).toBe(true);
      expect(path).not.toContain("passwd");
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(options).toEqual({ contentType: "image/jpeg", upsert: false });

      const values = insertCall(fake);
      expect(values).toEqual({
        id: path.slice("reports/".length, -".jpg".length),
        image_url: PUBLIC_BASE + path,
        latitude: 19.0178,
        longitude: 72.8478,
        category: "plastic",
        description: "Plastic bags piled beside a wall.",
        confidence: 0.9,
        ai_analysis: GARBAGE.outcome === "garbage" ? GARBAGE.classification : null,
        status: "pending",
        resolved_at: null,
        is_sample: false,
      });
      expect(fake.bucket.remove).not.toHaveBeenCalled();
    });

    it("prefers the user's description over the AI description", async () => {
      const fake = useSupabase([{ data: insertedRow({ description: "Near the bus stop" }), error: null }]);

      const res = await submit({ description: "  Near the bus stop  " });

      expect(res.status).toBe(201);
      expect(insertCall(fake).description).toBe("Near the bus stop");
    });

    it("falls back to the AI description when the user's is blank", async () => {
      const fake = useSupabase([{ data: insertedRow(), error: null }]);

      await submit({ description: "   " });

      expect(insertCall(fake).description).toBe("Plastic bags piled beside a wall.");
    });

    it("uses the extension of the detected type", async () => {
      const fake = useSupabase([{ data: insertedRow(), error: null }]);

      const res = await submit({ image: imageFile(PNG, "image/png") });

      expect(res.status).toBe(201);
      const [path, , options] = fake.bucket.upload.mock.calls[0] as unknown as [string, unknown, object];
      expect(path).toMatch(/\.png$/);
      expect(options).toEqual({ contentType: "image/png", upsert: false });
    });

    it("saves unclear_category as other with confidence and description, and no ai_analysis", async () => {
      vi.mocked(classifyImage).mockResolvedValue({
        outcome: "unclear_category",
        confidence: 0.7,
        description: "A pile of mixed refuse; the type is hard to tell.",
      });
      const fake = useSupabase([
        {
          data: insertedRow({
            category: "other",
            confidence: 0.7,
            description: "A pile of mixed refuse; the type is hard to tell.",
            ai_analysis: null,
          }),
          error: null,
        },
      ]);

      const res = await submit();

      expect(res.status).toBe(201);
      expect(insertCall(fake)).toMatchObject({
        category: "other",
        confidence: 0.7,
        description: "A pile of mixed refuse; the type is hard to tell.",
        ai_analysis: null,
        status: "pending",
        is_sample: false,
      });
      expect((await res.json()).report.category).toBe("other");
    });
  });

  describe("rejected photos", () => {
    it.each([
      ["not_garbage", /doesn't appear to show garbage/],
      ["uncertain", /clearer/],
    ] as const)("returns 422 for %s without uploading or inserting", async (outcome, message) => {
      vi.mocked(classifyImage).mockResolvedValue({ outcome, confidence: 0.95, description: "A clean road." });
      const fake = useSupabase([]);

      const res = await submit();

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toMatch(message);
      expect(body.error.details).toEqual({ outcome });
      expect(fake.bucket.upload).not.toHaveBeenCalled();
      expect(fake.queries).toHaveLength(0);
    });
  });

  describe("input validation (nothing is classified, uploaded, or inserted)", () => {
    function expectNoSideEffects() {
      expect(classifyImage).not.toHaveBeenCalled();
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    }

    it("rejects a missing image", async () => {
      const res = await submit({ image: null });
      expect(res.status).toBe(400);
      expectNoSideEffects();
    });

    it("rejects an unsupported format", async () => {
      const res = await submit({ image: imageFile([0x47, 0x49, 0x46, 0x38], "image/gif") });
      expect(res.status).toBe(400);
      expectNoSideEffects();
    });

    it("rejects a spoofed image", async () => {
      const res = await submit({ image: new File(["<html>"], "a.jpg", { type: "image/jpeg" }) });
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toBe("File content is not a valid JPEG, PNG, or WebP image");
      expectNoSideEffects();
    });

    it("rejects an image over 4 MB", async () => {
      const res = await submit({ image: imageFile(JPEG, "image/jpeg", MAX_IMAGE_BYTES + 1) });
      expect(res.status).toBe(413);
      expectNoSideEffects();
    });

    it("rejects an oversized body from Content-Length without reading it", async () => {
      const form = new FormData();
      form.set("image", imageFile(JPEG, "image/jpeg"));
      const request = await multipartRequest(form, { "content-length": String(MAX_IMAGE_BYTES + 70_000) });
      const formData = vi.spyOn(request, "formData");

      const res = await POST(request);

      expect(res.status).toBe(413);
      expect(formData).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it("rejects non-multipart and malformed multipart bodies", async () => {
      const json = new NextRequest("http://localhost/api/reports", {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json", "content-length": "2" },
      });
      expect((await POST(json)).status).toBe(415);

      const body = "--x\r\nnot really multipart";
      const malformed = new NextRequest("http://localhost/api/reports", {
        method: "POST",
        body,
        headers: { "content-type": "multipart/form-data; boundary=x", "content-length": String(body.length) },
      });
      const res = await POST(malformed);
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toBe("Request body is not valid multipart form data");
      expectNoSideEffects();
    });

    it.each([
      ["missing latitude", { latitude: null }, "latitude"],
      ["empty latitude", { latitude: "" }, "latitude"],
      ["latitude out of range", { latitude: "91" }, "latitude"],
      ["non-numeric latitude", { latitude: "abc" }, "latitude"],
      ["hex latitude", { latitude: "0x10" }, "latitude"],
      ["infinite latitude", { latitude: "Infinity" }, "latitude"],
      ["missing longitude", { longitude: null }, "longitude"],
      ["longitude out of range", { longitude: "-180.5" }, "longitude"],
      ["description over 1000 characters", { description: "x".repeat(1001) }, "description"],
      ["description sent as a file", { description: new File(["hi"], "d.txt") }, "description"],
    ])("rejects %s", async (_label, fields, field) => {
      const res = await submit(fields);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(Object.keys(body.error.details.fieldErrors)).toContain(field);
      expectNoSideEffects();
    });
  });

  describe("configuration and AI failures", () => {
    it("returns 503 listing every missing variable, before classifying", async () => {
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
      vi.stubEnv("GEMINI_MODEL", "");

      const res = await submit();

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("CONFIG_MISSING");
      expect(body.error.details.missing.sort()).toEqual(["GEMINI_MODEL", "SUPABASE_SERVICE_ROLE_KEY"]);
      expect(classifyImage).not.toHaveBeenCalled();
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });

    it.each([
      ["provider unavailable", new AiProviderError("unavailable"), 502, "AI_UNAVAILABLE"],
      ["rate limited", new AiProviderError("rate_limited"), 503, "AI_UNAVAILABLE"],
      ["invalid model output", new AiInvalidResponseError("bad json"), 502, "AI_INVALID_RESPONSE"],
    ])("does not create a report when the AI fails (%s)", async (_label, error, status, code) => {
      vi.mocked(classifyImage).mockRejectedValue(error);
      const fake = useSupabase([]);

      const res = await submit();

      expect(res.status).toBe(status);
      expect((await res.json()).error.code).toBe(code);
      expect(fake.bucket.upload).not.toHaveBeenCalled();
      expect(fake.queries).toHaveLength(0);
    });
  });

  describe("storage and database failures", () => {
    it("does not insert when the upload fails", async () => {
      const fake = useSupabase([], { uploadError: { message: "Bucket not found", statusCode: "404" } });

      const res = await submit();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: { code: "STORAGE_ERROR", message: "Image upload failed" } });
      expect(fake.queries).toHaveLength(0);
      expect(fake.bucket.remove).not.toHaveBeenCalled();
    });

    it("removes the uploaded image when the insert fails", async () => {
      const fake = useSupabase([{ data: null, error: { message: "violates check constraint", code: "23514" } }]);

      const res = await submit();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: { code: "DATABASE_ERROR", message: "Database request failed" } });
      const uploadedPath = fake.bucket.upload.mock.calls[0][0];
      expect(fake.bucket.remove).toHaveBeenCalledWith([uploadedPath]);
    });

    it.each([
      ["returns an error", { removeError: { message: "permission denied for 10.9.8.7" } }],
      ["throws", { removeThrows: true }],
    ])("keeps the safe database error when cleanup %s, and logs it server-side", async (_label, storage) => {
      const fake = useSupabase([{ data: null, error: { message: "connection reset by db.internal:5432" } }], storage);

      const res = await submit();

      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: { code: "DATABASE_ERROR", message: "Database request failed" } });
      expect(text).not.toMatch(/10\.9\.8\.7|db\.internal|sb_secret|stack/);
      expect(fake.bucket.remove).toHaveBeenCalledTimes(1);
      const logged = vi.mocked(console.error).mock.calls.flat().map(String).join("\n");
      expect(logged).toMatch(/Failed to remove orphaned image reports\//);
    });

    it("returns 500 for a contract-breaking row but keeps the image, because the row exists", async () => {
      const fake = useSupabase([{ data: insertedRow({ category: "glass" }), error: null }]);

      const res = await submit();

      expect(res.status).toBe(500);
      expect((await res.json()).error.code).toBe("DATABASE_ERROR");
      expect(fake.bucket.remove).not.toHaveBeenCalled();
    });
  });
});
