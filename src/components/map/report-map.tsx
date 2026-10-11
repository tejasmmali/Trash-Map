"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Place } from "@/lib/geocode";
import { HEAT_LEVELS, HEAT_MODE_HINTS, HEAT_MODE_LABELS, isValidCoordinate, type HeatMode } from "@/lib/heat-map";
import type { Report } from "@/types/reports";
import type { PickedLocation } from "@/components/reports/report-form";
import { MapSearch } from "./map-search";
import type { MapFocus } from "./report-heat-map";

const ReportHeatMap = dynamic(() => import("./report-heat-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading map…</div>
  ),
});

type Props = {
  reports: Report[];
  state: "loading" | "ready" | "error";
  demo: boolean;
  picked: PickedLocation | null;
  onPick: (location: PickedLocation) => void;
};

const MODES = Object.keys(HEAT_MODE_LABELS) as HeatMode[];
const GRADIENT_CSS = `linear-gradient(to right, ${HEAT_LEVELS.map((level) => level.color).join(", ")})`;

export function ReportMap({ reports, state, demo, picked, onPick }: Props) {
  const [mode, setMode] = useState<HeatMode>("density");
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const plotted =
    state === "ready"
      ? reports.filter(
          (report) =>
            isValidCoordinate(report.latitude, report.longitude) &&
            (mode === "density" || report.status !== "resolved"),
        ).length
      : 0;
  const overlay =
    state === "loading"
      ? "Loading reports…"
      : state === "error"
        ? "Reports could not be loaded, so the map has no data."
        : plotted === 0
          ? mode === "delay" && reports.length > 0
            ? "No unresolved reports to show."
            : "No reports to show."
          : null;

  return (
    <section aria-labelledby="map-heading" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="map-heading" className="text-lg font-medium">
          Map
        </h2>
        <MapSearch
          onSelect={(place: Place) => {
            setFocus((prev) => ({ place, key: (prev?.key ?? 0) + 1 }));
            onPick({ latitude: place.latitude, longitude: place.longitude, label: place.name });
          }}
        />
      </div>

      <div className="relative h-72 overflow-hidden rounded-lg border bg-muted/40 sm:h-96">
        <ReportHeatMap
          reports={state === "ready" ? reports : []}
          mode={mode}
          focus={focus}
          picked={picked}
          onPick={onPick}
        />
        {overlay && (
          <p
            role="status"
            className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background/90 px-3 py-1 text-xs whitespace-nowrap text-muted-foreground shadow-sm"
          >
            {overlay}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
        <div role="group" aria-label="Heat map mode" className="inline-flex rounded-lg border p-0.5">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                mode === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {HEAT_MODE_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="flex w-full max-w-64 flex-col gap-1 sm:w-64" aria-label="Heat legend">
          <div aria-hidden className="h-2 rounded-full" style={{ backgroundImage: GRADIENT_CSS }} />
          <ul className="flex justify-between text-muted-foreground">
            {HEAT_LEVELS.map((level) => (
              <li key={level.label}>{level.label}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {HEAT_MODE_HINTS[mode]} The map shows the reports loaded below, including their filters.{" "}
        {demo && "These are demo reports, not real submissions. "}
        Dots mark individual reports: red pending, amber in progress, green resolved. Click a dot for details, or
        click anywhere else to set the location for a new report.
      </p>
    </section>
  );
}
