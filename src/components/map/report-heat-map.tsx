"use client";

import "leaflet/dist/leaflet.css";
// The default import is Leaflet's live exports object, which `leaflet.heat`
// extends with `heatLayer`; a namespace import may be a snapshot without it.
import L from "leaflet";
import "leaflet.heat";
import { useEffect, useRef } from "react";
import { CATEGORY_LABELS, STATUS_LABELS, formatDate } from "@/components/reports/labels";
import type { Place } from "@/lib/geocode";
import {
  HEAT_GRADIENT,
  HEAT_MAX,
  INDIA_BOUNDS,
  INDIA_MIN_ZOOM,
  MUMBAI_CENTER,
  MUMBAI_ZOOM,
  buildHeatPoints,
  isValidCoordinate,
  type HeatMode,
} from "@/lib/heat-map";
import type { Report, ReportStatus } from "@/types/reports";

// Leaflet needs `window`, so this module is only loaded through `next/dynamic`
// with `ssr: false` (see report-map.tsx).

export type MapFocus = { place: Place; key: number };

type Props = { reports: Report[]; mode: HeatMode; focus: MapFocus | null };

const MARKER_COLORS: Record<ReportStatus, string> = {
  pending: "bg-red-600",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-600",
};

function markerIcon(status: ReportStatus): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span class="block size-3 rounded-full border-2 border-white shadow ${MARKER_COLORS[status]}"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6],
  });
}

/** Built with DOM nodes, never HTML strings, because descriptions are user input. */
function popupContent(report: Report): HTMLElement {
  const root = document.createElement("div");
  root.className = "flex max-w-56 flex-col gap-1 font-sans text-sm";
  const title = document.createElement("p");
  title.className = "font-medium";
  title.textContent = `${CATEGORY_LABELS[report.category]} · ${STATUS_LABELS[report.status]}`;
  root.append(title);
  if (report.description) {
    const description = document.createElement("p");
    description.textContent = report.description;
    root.append(description);
  }
  const date = document.createElement("p");
  date.className = "text-xs text-muted-foreground";
  date.textContent = `Reported ${formatDate(report.created_at)}${report.is_sample ? " · Sample" : ""}`;
  root.append(date);
  return root;
}

export default function ReportHeatMap({ reports, mode, focus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatRef = useRef<L.HeatLayer | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, {
      center: MUMBAI_CENTER,
      zoom: MUMBAI_ZOOM,
      minZoom: INDIA_MIN_ZOOM,
      maxZoom: 18,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: "saturate-50",
    }).addTo(map);
    // Wheel zoom only while the map has focus, so the page still scrolls.
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());

    // `maxZoom` equal to the minimum zoom stops leaflet.heat from fading
    // weights at lower zooms, so a weight means the same thing at every zoom.
    heatRef.current = L.heatLayer([], {
      radius: 22,
      blur: 18,
      max: HEAT_MAX,
      maxZoom: INDIA_MIN_ZOOM,
      minOpacity: 0.25,
      gradient: HEAT_GRADIENT,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // The container can change size with the layout (e.g. mobile rotation).
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      // leaflet.heat 0.2 doesn't cancel its scheduled redraw on removal, and the
      // redraw throws once the layer has no map.
      const heat = heatRef.current as (L.HeatLayer & { _frame?: number | null }) | null;
      if (heat?._frame) L.Util.cancelAnimFrame(heat._frame);
      map.remove();
      mapRef.current = null;
      heatRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const heat = heatRef.current;
    const markers = markersRef.current;
    if (!heat || !markers) return;

    heat.setLatLngs(buildHeatPoints(reports, mode, Date.now()));

    markers.clearLayers();
    for (const report of reports) {
      if (!isValidCoordinate(report.latitude, report.longitude)) continue;
      if (mode === "delay" && report.status === "resolved") continue;
      L.marker([report.latitude, report.longitude], {
        icon: markerIcon(report.status),
        title: `${CATEGORY_LABELS[report.category]} report, ${STATUS_LABELS[report.status]}`,
        alt: `${CATEGORY_LABELS[report.category]} report, ${STATUS_LABELS[report.status]}`,
        keyboard: true,
      })
        .bindPopup(() => popupContent(report))
        .addTo(markers);
    }
  }, [reports, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const { place } = focus;
    if (place.bounds) {
      map.flyToBounds(place.bounds, { maxZoom: 15, duration: 0.8 });
    } else {
      map.flyTo([place.latitude, place.longitude], 14, { duration: 0.8 });
    }
  }, [focus]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Map of garbage reports in India. Use the arrow keys to pan and plus or minus to zoom."
      className="z-0 h-full w-full font-sans"
    />
  );
}
