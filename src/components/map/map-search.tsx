"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MUMBAI_PLACES } from "./map-constants";

type MapSearchProps = {
  onSelectPlace: (place: { name: string; lat: number; lng: number }) => void;
};

export function MapSearch({ onSelectPlace }: MapSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return MUMBAI_PLACES.slice(0, 6);
    return MUMBAI_PLACES.filter((place) => place.name.toLowerCase().includes(trimmed)).slice(
      0,
      8,
    );
  }, [query]);

  return (
    <div className="relative w-full">
      <label className="sr-only" htmlFor="map-search">
        Search Mumbai locality
      </label>
      <div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] px-3 shadow-sm backdrop-blur-md">
        <Search aria-hidden className="size-4 shrink-0 text-[var(--map-muted)]" />
        <input
          id="map-search"
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Search locality"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--map-fg)] outline-none placeholder:text-[var(--map-muted)]"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        {query && (
          <button
            type="button"
            className="rounded-md p-1 text-[var(--map-muted)] hover:bg-white/10 hover:text-[var(--map-fg)]"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setQuery("")}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Locality suggestions"
          className="absolute top-[calc(100%+0.35rem)] z-20 max-h-56 w-full overflow-auto rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_96%,transparent)] py-1 shadow-lg backdrop-blur-md"
        >
          {matches.map((place) => (
            <li key={place.name}>
              <button
                type="button"
                role="option"
                aria-selected={query.trim().toLowerCase() === place.name.toLowerCase()}
                className="flex w-full px-3 py-2.5 text-left text-sm text-[var(--map-fg)] hover:bg-white/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(place.name);
                  setOpen(false);
                  onSelectPlace(place);
                }}
              >
                {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
