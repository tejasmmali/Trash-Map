import { z } from "zod";
import { INDIA_BOUNDS } from "@/lib/heat-map";

export type Place = {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
  /** `[[south, west], [north, east]]`, when the provider gives one. */
  bounds: [[number, number], [number, number]] | null;
};

export type SearchPlacesResult = { ok: true; places: Place[] } | { ok: false; message: string };

/** Nominatim's public server allows at most one request per second per app. */
export const MIN_REQUEST_INTERVAL_MS = 1100;
export const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

// Overridable so the provider can be switched without code changes, as the
// Nominatim usage policy requires.
const DEFAULT_GEOCODER_URL =
  process.env.NEXT_PUBLIC_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";

const coordinate = z.coerce.number().refine(Number.isFinite);

const nominatimResultSchema = z.object({
  place_id: z.union([z.number(), z.string()]),
  display_name: z.string().min(1),
  lat: coordinate,
  lon: coordinate,
  boundingbox: z.tuple([coordinate, coordinate, coordinate, coordinate]).optional(),
});

function insideIndia(latitude: number, longitude: number): boolean {
  const [[south, west], [north, east]] = INDIA_BOUNDS;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

function toPlace(result: z.infer<typeof nominatimResultSchema>): Place {
  const [name, ...rest] = result.display_name.split(", ");
  const box = result.boundingbox;
  return {
    id: String(result.place_id),
    name,
    detail: rest.join(", "),
    latitude: result.lat,
    longitude: result.lon,
    bounds: box ? [[box[0], box[2]], [box[1], box[3]]] : null,
  };
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

type GeocoderDeps = {
  fetch?: typeof fetch;
  url?: string;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export function createGeocoder({
  fetch: fetchImpl = (...args) => fetch(...args),
  url = DEFAULT_GEOCODER_URL,
  now = Date.now,
  sleep = abortableSleep,
}: GeocoderDeps = {}) {
  const cache = new Map<string, Place[]>();
  let nextSlot = 0;

  return async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchPlacesResult> {
    const trimmed = query.trim().replace(/\s+/g, " ");
    if (trimmed.length < MIN_QUERY_LENGTH) {
      return { ok: false, message: `Type at least ${MIN_QUERY_LENGTH} characters.` };
    }
    const key = trimmed.toLowerCase();
    const cached = cache.get(key);
    if (cached) return { ok: true, places: cached };

    // Reserve the next free slot before waiting so concurrent calls queue up.
    const slot = Math.max(now(), nextSlot);
    nextSlot = slot + MIN_REQUEST_INTERVAL_MS;
    const wait = slot - now();

    const params = new URLSearchParams({
      q: trimmed,
      format: "jsonv2",
      countrycodes: "in",
      limit: String(MAX_RESULTS),
      "accept-language": "en",
    });

    let response: Response;
    try {
      if (wait > 0) await sleep(wait, signal);
      response = await fetchImpl(`${url}?${params}`, { signal, headers: { Accept: "application/json" } });
    } catch (error) {
      if (signal?.aborted) throw error;
      return { ok: false, message: "Location search is unavailable. Check your connection and try again." };
    }

    if (response.status === 429) {
      return { ok: false, message: "Too many searches. Wait a moment and try again." };
    }
    if (!response.ok) {
      return { ok: false, message: "Location search is unavailable right now. Try again later." };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, message: "Location search returned an unexpected response." };
    }
    if (!Array.isArray(body)) {
      return { ok: false, message: "Location search returned an unexpected response." };
    }

    const places = body
      .map((item) => nominatimResultSchema.safeParse(item))
      .flatMap((parsed) => (parsed.success ? [toPlace(parsed.data)] : []))
      .filter((place) => insideIndia(place.latitude, place.longitude));
    cache.set(key, places);
    return { ok: true, places };
  };
}

export const searchPlaces = createGeocoder();

/** Common Mumbai localities, matched locally as the user types (no network). */
export const MUMBAI_LOCALITIES: Place[] = (
  [
    ["Andheri", 19.1197, 72.8468],
    ["Bandra", 19.0596, 72.8295],
    ["Borivali", 19.2307, 72.8567],
    ["Byculla", 18.979, 72.833],
    ["Chembur", 19.0522, 72.9005],
    ["Colaba", 18.9067, 72.8147],
    ["Dadar", 19.0178, 72.8478],
    ["Ghatkopar", 19.086, 72.9081],
    ["Goregaon", 19.1663, 72.8526],
    ["Juhu", 19.0988, 72.8267],
    ["Kurla", 19.0726, 72.8845],
    ["Malad", 19.1874, 72.8484],
    ["Marine Drive", 18.9432, 72.8235],
    ["Mulund", 19.1726, 72.9425],
    ["Powai", 19.1176, 72.906],
    ["Sion", 19.039, 72.8619],
    ["Worli", 19.0177, 72.817],
  ] as const
).map(([name, latitude, longitude]) => ({
  id: `mumbai-${name.toLowerCase().replace(/\s+/g, "-")}`,
  name,
  detail: "Mumbai",
  latitude,
  longitude,
  bounds: null,
}));

export function matchLocalities(query: string, limit = 5): Place[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return MUMBAI_LOCALITIES.filter((place) => place.name.toLowerCase().startsWith(needle)).slice(0, limit);
}
