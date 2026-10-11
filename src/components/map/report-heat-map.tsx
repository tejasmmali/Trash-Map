"use client";

import "leaflet/dist/leaflet.css";
import * as L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { buildHeatCells, heatColor, heatScale, type HeatMode } from "@/lib/heat-grid";
import type { Report } from "@/types/reports";

// Leaflet needs `window`, so this module must only be loaded through
// `next/dynamic` with `ssr: false` (see report-map.tsx).

const MUMBAI_CENTER: L.LatLngTuple = [19.076, 72.8777];
const DEFAULT_ZOOM = 11;
/** Cell edge in screen pixels; cells are regrouped on every zoom. */
const CELL_PX = 14;
const CELL_GAP_PX = 1;

type Props = { reports: Report[]; mode: HeatMode };

export default function ReportHeatMap({ reports, mode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cellsRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      center: MUMBAI_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 9,
      maxZoom: 18,
      scrollWheelZoom: false,
      renderer: L.canvas({ padding: 0.5 }),
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      opacity: 0.55,
      className: "grayscale brightness-[1.12] contrast-[0.7]",
    }).addTo(map);
    cellsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
      map.remove();
      mapRef.current = null;
      cellsRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = cellsRef.current;
    if (!map || !group) return;

    if (!fittedRef.current && reports.length > 0) {
      fittedRef.current = true;
      const bounds = L.latLngBounds(reports.map((r) => [r.latitude, r.longitude] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13, animate: false });
    }

    const z = map.getZoom();
    const cells = buildHeatCells(reports, {
      mode,
      now: Date.now(),
      cellSize: CELL_PX,
      project: (lat, lng) => map.project([lat, lng], z),
    });
    const scale = heatScale(cells);

    group.clearLayers();
    for (const cell of cells) {
      const x = cell.col * CELL_PX;
      const y = cell.row * CELL_PX;
      const bounds = L.latLngBounds(
        map.unproject([x + CELL_GAP_PX, y + CELL_GAP_PX], z),
        map.unproject([x + CELL_PX - CELL_GAP_PX, y + CELL_PX - CELL_GAP_PX], z),
      );
      const reportsLabel = `${cell.count} report${cell.count === 1 ? "" : "s"}`;
      L.rectangle(bounds, {
        stroke: false,
        fillColor: heatColor(cell.weight / scale),
        fillOpacity: 0.9,
      })
        .bindTooltip(mode === "unresolved" ? `${reportsLabel} open` : reportsLabel, {
          direction: "top",
          offset: [0, -CELL_PX / 2],
        })
        .addTo(group);
    }
  }, [reports, mode, zoom]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Heat map of garbage reports in Mumbai"
      className="h-full w-full bg-background! font-sans"
    />
  );
}
