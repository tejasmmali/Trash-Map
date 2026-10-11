import { afterEach, describe, expect, it, vi } from "vitest";
import { checkImageFile, classifyPhoto } from "@/lib/classify-client";
import { MAX_IMAGE_BYTES } from "@/lib/validation/reports";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn<typeof fetch>(async () =>
    typeof body === "string" ? new Response(body, { status }) : Response.json(body, { status }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jpeg(size = 10) {
  return new File([new Uint8Array(size)], "photo.jpg", { type: "image/jpeg" });
}

const GARBAGE = {
  outcome: "garbage",
  classification: {
    is_garbage: true,
    category: "plastic",
    confidence: 0.9,
    description: "Plastic bottles beside the road.",
    severity: "medium",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkImageFile", () => {
  it("accepts a small JPEG", () => {
    expect(checkImageFile(jpeg())).toBeNull();
  });

  it("rejects other types, empty files, and files over 4 MB", () => {
    expect(checkImageFile(new File(["x"], "a.gif", { type: "image/gif" }))).toMatch(/JPEG, PNG, or WebP/);
    expect(checkImageFile(jpeg(0))).toMatch(/empty/);
    expect(checkImageFile(jpeg(MAX_IMAGE_BYTES + 1))).toMatch(/4 MB/);
  });
});

describe("classifyPhoto", () => {
  it("posts the image as multipart and returns the validated result", async () => {
    const fetchMock = mockFetch(200, GARBAGE);
    const file = jpeg();

    const result = await classifyPhoto(file);

    expect(result).toEqual({ ok: true, result: GARBAGE });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/classify");
    expect(init?.method).toBe("POST");
    expect((init?.body as FormData).get("image")).toBe(file);
  });

  it("returns non-garbage outcomes", async () => {
    const body = { outcome: "not_garbage", confidence: 1, description: "A clean road." };
    mockFetch(200, body);
    expect(await classifyPhoto(jpeg())).toEqual({ ok: true, result: body });
  });

  it("does not call the server for an invalid file", async () => {
    const fetchMock = mockFetch(200, GARBAGE);
    const result = await classifyPhoto(new File(["x"], "a.gif", { type: "image/gif" }));
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the API error message", async () => {
    mockFetch(502, { error: { code: "AI_UNAVAILABLE", message: "The AI service is unavailable. Try again later." } });
    expect(await classifyPhoto(jpeg())).toEqual({
      ok: false,
      message: "The AI service is unavailable. Try again later.",
    });
  });

  it("falls back to the HTTP status for non-API errors", async () => {
    mockFetch(500, "<html>oops</html>");
    expect(await classifyPhoto(jpeg())).toEqual({ ok: false, message: "Request failed (HTTP 500)." });
  });

  it("rejects a malformed success body", async () => {
    mockFetch(200, { outcome: "garbage", classification: { category: "plastic" } });
    expect(await classifyPhoto(jpeg())).toEqual({
      ok: false,
      message: "The server returned data in an unexpected format.",
    });
  });

  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await classifyPhoto(jpeg())).toEqual({ ok: false, message: "Could not reach the server." });
  });
});
