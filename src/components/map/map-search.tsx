"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { matchLocalities, searchPlaces, type Place } from "@/lib/geocode";

type Props = { onSelect: (place: Place) => void };

type Remote =
  | { kind: "idle" }
  | { kind: "searching"; query: string }
  | { kind: "done"; query: string; places: Place[] }
  | { kind: "error"; message: string };

export function MapSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<Remote>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  // Nominatim forbids search-as-you-type, so typing only matches a local list
  // of Mumbai localities; the provider is queried when the user submits.
  const typedSuggestions = remote.kind === "idle" ? matchLocalities(query) : [];
  const places = remote.kind === "done" ? remote.places : typedSuggestions;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setOpen(true);
    setRemote({ kind: "searching", query: trimmed });
    try {
      const result = await searchPlaces(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setRemote(
        result.ok ? { kind: "done", query: trimmed, places: result.places } : { kind: "error", message: result.message },
      );
    } catch {
      // Aborted by a newer search or unmount.
    }
  }

  function choose(place: Place) {
    setQuery(place.name);
    setOpen(false);
    setRemote({ kind: "idle" });
    onSelect(place);
  }

  const status =
    remote.kind === "searching"
      ? "Searching…"
      : remote.kind === "error"
        ? remote.message
        : remote.kind === "done" && remote.places.length === 0
          ? `No places in India found for “${remote.query}”.`
          : "";

  return (
    <div
      className="relative w-full sm:max-w-sm"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <form role="search" onSubmit={submit} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 focus-within:ring-2 focus-within:ring-ring/50">
        <label htmlFor="map-search" className="sr-only">
          Search city or area in India
        </label>
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input
          id="map-search"
          type="search"
          value={query}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search city or area in India..."
          aria-describedby="map-search-hint"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setQuery(event.target.value);
            setRemote({ kind: "idle" });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {remote.kind === "searching" && (
          <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
        )}
      </form>
      <p id="map-search-hint" className="sr-only">
        Press Enter to search all of India.
      </p>
      <p role="status" className="sr-only">
        {status}
      </p>

      {open && (places.length > 0 || status) && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {places.length > 0 && (
            <ul className="max-h-64 overflow-auto py-1">
              {places.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => choose(place)}
                  >
                    <span className="font-medium">{place.name}</span>
                    {place.detail && (
                      <span className="truncate text-xs text-muted-foreground">{place.detail}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {status && <p className="px-3 py-2 text-sm text-muted-foreground">{status}</p>}
          {remote.kind === "idle" && query.trim() && (
            <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">Press Enter to search all of India</p>
          )}
        </div>
      )}
    </div>
  );
}
