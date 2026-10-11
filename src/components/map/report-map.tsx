"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HEAT_STOPS, type HeatMode } from "@/lib/heat-grid";
import type { Report } from "@/types/reports";

const ReportHeatMap = dynamic(() => import("./report-heat-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const MODES: Record<HeatMode, { label: string; low: string; high: string; note: string }> = {
  density: {
    label: "All reports",
    low: "Fewer",
    high: "More reports",
    note: "Each square groups nearby reports; hotter squares have more.",
  },
  unresolved: {
    label: "Unresolved",
    low: "New",
    high: "Open longest",
    note: "Resolved reports are hidden. Squares heat up the longer their reports stay open.",
  },
};

export function ReportMap({ reports }: { reports: Report[] }) {
  const [mode, setMode] = useState<HeatMode>("density");
  const current = MODES[mode];

  return (
    <section aria-labelledby="map-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="map-heading" className="text-lg font-medium">
          Heat map
        </h2>
        <div role="group" aria-label="Heat map mode" className="flex gap-1">
          {(Object.keys(MODES) as HeatMode[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={mode === key ? "default" : "outline"}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {MODES[key].label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative isolate h-[420px] overflow-hidden rounded-lg border bg-background">
        <ReportHeatMap reports={reports} mode={mode} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>{current.note} Uses the reports loaded below, including active filters.</p>
        <div className="flex items-center gap-2" aria-hidden>
          <span>{current.low}</span>
          <span className="flex gap-0.5">
            {HEAT_STOPS.map(([, color]) => (
              <span key={color} className="size-3" style={{ backgroundColor: color }} />
            ))}
          </span>
          <span>{current.high}</span>
        </div>
      </div>
    </section>
  );
}
