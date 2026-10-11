import { describe, expect, it, vi } from "vitest";
import { MIN_REQUEST_INTERVAL_MS, createGeocoder, matchLocalities } from "@/lib/geocode";

const DADAR = {
  place_id: 123,
  display_name: "Dadar, G/North Ward, Mumbai, Maharashtra, 400028, India",
  lat: "19.0178",
  lon: "72.8478",
  boundingbox: ["19.0", "19.03", "72.83", "72.86"],
};

function setup(responses: (Response | Error)[]) {
  let clock = 10_000;
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const search = createGeocoder({ fetch, sleep, now: () => clock, url: "https://geo.test/search" });
  return { search, fetch, sleep, advance: (ms: number) => (clock += ms) };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("createGeocoder", () => {
  it("queries India only and maps results to places", async () => {
    const { search, fetch } = setup([json([DADAR])]);

    const result = await search("  Dadar   Mumbai ");

    const url = new URL(fetch.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://geo.test/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "Dadar Mumbai",
      format: "jsonv2",
      countrycodes: "in",
      limit: "5",
      "accept-language": "en",
    });
    expect(result).toEqual({
      ok: true,
      places: [
        {
          id: "123",
          name: "Dadar",
          detail: "G/North Ward, Mumbai, Maharashtra, 400028, India",
          latitude: 19.0178,
          longitude: 72.8478,
          bounds: [
            [19.0, 72.83],
            [19.03, 72.86],
          ],
        },
      ],
    });
  });

  it("caches repeated queries case-insensitively", async () => {
    const { search, fetch } = setup([json([DADAR])]);

    await search("Dadar");
    const second = await search("dadar");

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second.ok && second.places[0].name).toBe("Dadar");
  });

  it("waits so requests are at least the minimum interval apart", async () => {
    const { search, sleep, advance } = setup([json([]), json([]), json([])]);

    await search("Pune");
    expect(sleep).not.toHaveBeenCalled();
    advance(300);
    await search("Nagpur");
    expect(sleep).toHaveBeenLastCalledWith(MIN_REQUEST_INTERVAL_MS - 300, undefined);
    advance(5000);
    await search("Nashik");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not call the provider for very short queries", async () => {
    const { search, fetch } = setup([]);
    expect(await search(" a ")).toEqual({ ok: false, message: "Type at least 2 characters." });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("drops malformed results and results outside India", async () => {
    const { search } = setup([
      json([DADAR, { place_id: 1, display_name: "London, UK", lat: "51.5", lon: "-0.12" }, { nope: true }]),
    ]);
    const result = await search("dadar");
    expect(result.ok && result.places.map((place) => place.name)).toEqual(["Dadar"]);
  });

  it.each([
    ["rate limit", json({}, 429), "Too many searches. Wait a moment and try again."],
    ["server error", json({}, 503), "Location search is unavailable right now. Try again later."],
    ["non-JSON body", new Response("<html>"), "Location search returned an unexpected response."],
    ["non-array body", json({ error: "x" }), "Location search returned an unexpected response."],
    ["network failure", new TypeError("fetch failed"), "Location search is unavailable. Check your connection and try again."],
  ])("returns a readable error on %s and does not cache it", async (_label, response, message) => {
    const { search, fetch } = setup([response, json([DADAR])]);

    expect(await search("Dadar")).toEqual({ ok: false, message });
    expect((await search("Dadar")).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rethrows when the caller aborts", async () => {
    const controller = new AbortController();
    const { search } = setup([new DOMException("aborted", "AbortError")]);
    controller.abort();
    await expect(search("Dadar", controller.signal)).rejects.toThrow();
  });
});

describe("matchLocalities", () => {
  it("matches Mumbai localities by prefix without the network", () => {
    expect(matchLocalities("ba").map((place) => place.name)).toEqual(["Bandra"]);
    expect(matchLocalities("  DA ").map((place) => place.name)).toEqual(["Dadar"]);
    expect(matchLocalities("")).toEqual([]);
    expect(matchLocalities("zzz")).toEqual([]);
  });
});
