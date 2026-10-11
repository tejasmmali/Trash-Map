"use client";

import dynamic from "next/dynamic";
import type { MapViewHandle } from "./map-view";
import type { Report } from "@/types/reports";
import type { MapLayerMode } from "./map-constants";

export type { MapViewHandle };

type TrashMapProps = {
  reports: Report[];
  layer: MapLayerMode;
  selectedId?: string | null;
  onSelectReports: (reports: Report[]) => void;
  onReady?: (handle: MapViewHandle) => void;
  onLocateError?: (message: string) => void;
};

const MapView = dynamic(() => import("./map-view").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div
      className="absolute inset-0 flex items-center justify-center bg-[var(--map-bg)] text-sm text-[var(--map-muted)]"
      role="status"
    >
      Loading map…
    </div>
  ),
});

export function TrashMap(props: TrashMapProps) {
  return <MapView {...props} />;
}
