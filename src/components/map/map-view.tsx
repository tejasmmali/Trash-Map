"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Report } from "@/types/reports";
import {
  LAND_CELL_COLOR,
  MAP_SEA_COLOR,
  densityColor,
  densityTier,
  reportWeight,
  type MapLayerMode,
} from "./map-constants";
import {
  WORLD_LAT_MAX,
  WORLD_LAT_MIN,
  WORLD_LEVELS,
  latLngToCell,
  normalizeLng,
} from "./world-land";

export type MapViewHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  locateUser: () => void;
  invalidateSize: () => void;
};

type MapViewProps = {
  reports: Report[];
  layer: MapLayerMode;
  selectedId?: string | null;
  onSelectReports: (reports: Report[]) => void;
  onReady?: (handle: MapViewHandle) => void;
  onLocateError?: (message: string) => void;
};

type CellBucket = {
  weight: number;
  reports: Report[];
};

type DrawState = {
  reports: Report[];
  layer: MapLayerMode;
  selectedId?: string | null;
};

/** Camera in geographic units. `zoom` 1 = whole world fits the canvas. */
type Camera = {
  zoom: number;
  centerLat: number;
  centerLng: number;
};

type Layout = {
  cssW: number;
  cssH: number;
  /** Pixels per degree at the current zoom. */
  pxPerDeg: number;
  /** Pixels per degree at zoom 1 for this canvas size. */
  basePxPerDeg: number;
  level: number;
};

type GeoPoint = { lat: number; lng: number };

type Tooltip = {
  x: number;
  y: number;
  label: string;
  count: number;
  /** Canvas width at the time of hover, used to keep the tooltip on-screen. */
  maxX: number;
};

const MIN_ZOOM = 1;
/** Finest level stays readable up to roughly 34px between dot centers. */
const MAX_LEVEL_PITCH_PX = 34;
/** Prefer the finest level whose dot pitch is at least this many pixels. */
const MIN_LEVEL_PITCH_PX = 4.2;
const FLY_TO_PITCH_PX = 14;
const DRAG_THRESHOLD_PX = 4;
const FINEST = WORLD_LEVELS.length - 1;

const SPAN_LAT = WORLD_LAT_MAX - WORLD_LAT_MIN;

function pitchForLevel(level: number, pxPerDeg: number): number {
  return (360 / WORLD_LEVELS[level].cols) * pxPerDeg;
}

function pickLevel(pxPerDeg: number): number {
  for (let level = FINEST; level > 0; level--) {
    if (pitchForLevel(level, pxPerDeg) >= MIN_LEVEL_PITCH_PX) return level;
  }
  return 0;
}

function maxZoomFor(basePxPerDeg: number): number {
  // Zoom at which the finest level's pitch hits MAX_LEVEL_PITCH_PX.
  return Math.max(
    MIN_ZOOM,
    MAX_LEVEL_PITCH_PX / ((360 / WORLD_LEVELS[FINEST].cols) * basePxPerDeg),
  );
}

function baseScale(cssW: number, cssH: number): number {
  const padX = cssW * 0.02;
  const padY = cssH * 0.04;
  return Math.min((cssW - padX * 2) / 360, (cssH - padY * 2) / SPAN_LAT);
}

function clampCamera(camera: Camera, cssW: number, cssH: number): Camera {
  // A hidden or collapsing container must never clamp the user's zoom away.
  if (!(cssW >= 8) || !(cssH >= 8)) return camera;
  const base = baseScale(cssW, cssH);
  if (!(base > 0)) return camera;
  const maxZoom = maxZoomFor(base);
  const zoom = Math.min(maxZoom, Math.max(MIN_ZOOM, camera.zoom));
  const pxPerDeg = base * zoom;
  const halfW = cssW / 2 / pxPerDeg;
  const halfH = cssH / 2 / pxPerDeg;

  const centerLng =
    halfW >= 180 ? 0 : Math.min(180 - halfW, Math.max(-180 + halfW, camera.centerLng));
  const centerLat =
    halfH >= SPAN_LAT / 2
      ? 0
      : Math.min(WORLD_LAT_MAX - halfH, Math.max(WORLD_LAT_MIN + halfH, camera.centerLat));

  return { zoom, centerLat, centerLng };
}

function buildBuckets(
  reports: Report[],
  layer: MapLayerMode,
  level: number,
): Map<string, CellBucket> {
  const buckets = new Map<string, CellBucket>();
  const now = Date.now();

  for (const report of reports) {
    const cell = latLngToCell(report.latitude, report.longitude, level);
    if (!cell) continue;
    const weight = reportWeight(report, layer === "reports" ? "density" : layer, now);
    if (layer === "unresolved" && weight <= 0) continue;
    const key = `${cell.col}:${cell.row}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.weight += weight;
      existing.reports.push(report);
    } else {
      buckets.set(key, { weight, reports: [report] });
    }
  }
  return buckets;
}

type BucketCache = { level: number; layer: MapLayerMode; reports: Report[]; buckets: Map<string, CellBucket> };

function paintWorldMap(
  canvas: HTMLCanvasElement,
  wrap: HTMLDivElement,
  state: DrawState,
  camera: Camera,
  hover: GeoPoint | null,
  pulse: { point: GeoPoint; until: number } | null,
  layoutOut: Layout,
  bucketCache: BucketCache,
) {
  const cssW = wrap.clientWidth;
  const cssH = wrap.clientHeight;
  if (cssW < 8 || cssH < 8) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = MAP_SEA_COLOR;
  ctx.fillRect(0, 0, cssW, cssH);

  const basePxPerDeg = baseScale(cssW, cssH);
  const pxPerDeg = basePxPerDeg * camera.zoom;
  const level = pickLevel(pxPerDeg);
  const { cols, rows, mask } = WORLD_LEVELS[level];
  const cellDeg = 360 / cols;
  const pitch = cellDeg * pxPerDeg;
  const radius = Math.max(0.75, pitch * 0.34);

  layoutOut.cssW = cssW;
  layoutOut.cssH = cssH;
  layoutOut.pxPerDeg = pxPerDeg;
  layoutOut.basePxPerDeg = basePxPerDeg;
  layoutOut.level = level;
  wrap.dataset.zoom = camera.zoom.toFixed(2);
  wrap.dataset.level = String(level);

  if (
    bucketCache.level !== level ||
    bucketCache.layer !== state.layer ||
    bucketCache.reports !== state.reports
  ) {
    bucketCache.level = level;
    bucketCache.layer = state.layer;
    bucketCache.reports = state.reports;
    bucketCache.buckets = buildBuckets(state.reports, state.layer, level);
  }
  const buckets = bucketCache.buckets;
  let maxWeight = 0;
  for (const bucket of buckets.values()) maxWeight = Math.max(maxWeight, bucket.weight);

  // Screen-space origin of the world's top-left corner.
  const originX = cssW / 2 - (camera.centerLng + 180) * pxPerDeg;
  const originY = cssH / 2 - (WORLD_LAT_MAX - camera.centerLat) * pxPerDeg;

  const colStart = Math.max(0, Math.floor((0 - originX) / pitch) - 1);
  const colEnd = Math.min(cols - 1, Math.ceil((cssW - originX) / pitch) + 1);
  const rowStart = Math.max(0, Math.floor((0 - originY) / pitch) - 1);
  const rowEnd = Math.min(rows - 1, Math.ceil((cssH - originY) / pitch) + 1);

  const now = performance.now();
  const hoverCell = hover ? latLngToCell(hover.lat, hover.lng, level) : null;
  const pulseCell =
    pulse && pulse.until > now ? latLngToCell(pulse.point.lat, pulse.point.lng, level) : null;

  const ringColor = "#eff6ef";

  for (let row = rowStart; row <= rowEnd; row++) {
    const cy = originY + row * pitch + pitch / 2;
    for (let col = colStart; col <= colEnd; col++) {
      if (mask[row * cols + col] !== 1) continue;

      const bucket = buckets.get(`${col}:${row}`);
      const tier =
        state.layer === "reports" || !bucket ? 0 : densityTier(bucket.weight, maxWeight);
      let fill = densityColor(tier) ?? LAND_CELL_COLOR;

      if (
        state.layer === "reports" &&
        bucket?.reports.some((report) => report.id === state.selectedId)
      ) {
        fill = "#d9555f";
      }

      const cx = originX + col * pitch + pitch / 2;
      const isHover = hoverCell !== null && hoverCell.col === col && hoverCell.row === row;
      const isPulse = pulseCell !== null && pulseCell.col === col && pulseCell.row === row;

      // Heat dots get a little extra size so they read against the land dots.
      const dotRadius = isHover ? radius * 1.3 : bucket ? radius * 1.12 : radius;

      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = isHover && !bucket ? "#9fb0a7" : fill;
      ctx.fill();

      if (isHover || isPulse) {
        ctx.lineWidth = Math.max(1.5, radius * 0.35);
        ctx.strokeStyle = ringColor;
        ctx.stroke();
      }
    }
  }
}

export function MapView({
  reports,
  layer,
  selectedId,
  onSelectReports,
  onReady,
  onLocateError,
}: MapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<Layout>({ cssW: 0, cssH: 0, pxPerDeg: 1, basePxPerDeg: 1, level: 0 });
  const cameraRef = useRef<Camera>({ zoom: 1, centerLat: 0, centerLng: 0 });
  const hoverRef = useRef<GeoPoint | null>(null);
  const pulseRef = useRef<{ point: GeoPoint; until: number } | null>(null);
  const stateRef = useRef<DrawState>({ reports, layer, selectedId });
  const bucketCacheRef = useRef<BucketCache>({
    level: -1,
    layer,
    reports,
    buckets: new Map(),
  });
  const onSelectRef = useRef(onSelectReports);
  const onLocateErrorRef = useRef(onLocateError);
  const onReadyRef = useRef(onReady);
  const frameRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<
    | { kind: "idle" }
    | { kind: "drag"; startX: number; startY: number; camera: Camera; moved: boolean }
    | { kind: "pinch"; dist: number; zoom: number }
  >({ kind: "idle" });
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [cursor, setCursor] = useState<"grab" | "grabbing" | "pointer">("grab");

  useEffect(() => {
    onSelectRef.current = onSelectReports;
    onLocateErrorRef.current = onLocateError;
    onReadyRef.current = onReady;
  });

  function paintNow() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    if (wrap.clientWidth < 8 || wrap.clientHeight < 8) return;
    cameraRef.current = clampCamera(cameraRef.current, wrap.clientWidth, wrap.clientHeight);
    paintWorldMap(
      canvas,
      wrap,
      stateRef.current,
      cameraRef.current,
      hoverRef.current,
      pulseRef.current,
      layoutRef.current,
      bucketCacheRef.current,
    );
  }

  function schedulePaint() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      paintNow();
    });
  }

  function screenToGeo(x: number, y: number): GeoPoint {
    const { cssW, cssH, pxPerDeg } = layoutRef.current;
    const camera = cameraRef.current;
    return {
      lng: camera.centerLng + (x - cssW / 2) / pxPerDeg,
      lat: camera.centerLat - (y - cssH / 2) / pxPerDeg,
    };
  }

  function zoomAbout(factor: number, x: number, y: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { cssW, cssH, basePxPerDeg } = layoutRef.current;
    const before = screenToGeo(x, y);
    const camera = cameraRef.current;
    const maxZoom = maxZoomFor(basePxPerDeg);
    const zoom = Math.min(maxZoom, Math.max(MIN_ZOOM, camera.zoom * factor));
    const pxPerDeg = basePxPerDeg * zoom;
    cameraRef.current = clampCamera(
      {
        zoom,
        centerLng: before.lng - (x - cssW / 2) / pxPerDeg,
        centerLat: before.lat + (y - cssH / 2) / pxPerDeg,
      },
      cssW,
      cssH,
    );
    schedulePaint();
  }

  function animateTo(target: Camera, durationMs = 420) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const from = cameraRef.current;
    const to = clampCamera(target, wrap.clientWidth, wrap.clientHeight);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= 0) {
      cameraRef.current = to;
      schedulePaint();
      return;
    }
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const e = 1 - Math.pow(1 - p, 3);
      cameraRef.current = {
        zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e),
        centerLat: from.centerLat + (to.centerLat - from.centerLat) * e,
        centerLng: from.centerLng + (to.centerLng - from.centerLng) * e,
      };
      paintNow();
      if (p < 1) animRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
  }

  function updateHover(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const geo = screenToGeo(x, y);
    const { level } = layoutRef.current;
    const cell = latLngToCell(geo.lat, geo.lng, level);
    const { cols, mask } = WORLD_LEVELS[level];
    const onLand = cell !== null && mask[cell.row * cols + cell.col] === 1;

    const prev = hoverRef.current;
    const prevCell = prev ? latLngToCell(prev.lat, prev.lng, level) : null;
    const sameCell =
      (!onLand && prev === null) ||
      (onLand && prevCell !== null && cell !== null && prevCell.col === cell.col && prevCell.row === cell.row);

    hoverRef.current = onLand ? geo : null;
    if (!sameCell) schedulePaint();

    if (!onLand || !cell) {
      setTooltip((t) => (t ? null : t));
      setCursor((c) => (c === "pointer" ? "grab" : c));
      return;
    }

    const bucket = bucketCacheRef.current.buckets.get(`${cell.col}:${cell.row}`);
    const count = bucket?.reports.length ?? 0;
    const label =
      count === 0 ? "No reports here" : count === 1 ? "1 report" : `${count} reports`;
    const maxX = layoutRef.current.cssW;
    setTooltip((t) =>
      t && t.label === label && Math.abs(t.x - x) < 1 && Math.abs(t.y - y) < 1
        ? t
        : { x, y, label, count, maxX },
    );
    setCursor((c) => (c === "grabbing" ? c : count > 0 ? "pointer" : "grab"));
  }

  function clearHover() {
    if (hoverRef.current !== null) {
      hoverRef.current = null;
      schedulePaint();
    }
    setTooltip(null);
    setCursor((c) => (c === "grabbing" ? c : "grab"));
  }

  function selectAt(x: number, y: number) {
    const geo = screenToGeo(x, y);
    const { level } = layoutRef.current;
    const cell = latLngToCell(geo.lat, geo.lng, level);
    if (!cell) return;
    const bucket = bucketCacheRef.current.buckets.get(`${cell.col}:${cell.row}`);
    if (!bucket || bucket.reports.length === 0) return;
    onSelectRef.current(bucket.reports);
  }

  useEffect(() => {
    stateRef.current = { reports, layer, selectedId };
    schedulePaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, layer, selectedId]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const handle: MapViewHandle = {
      flyTo(lat, lng, zoom) {
        const { basePxPerDeg } = layoutRef.current;
        const finestCellDeg = 360 / WORLD_LEVELS[FINEST].cols;
        const targetZoom =
          zoom ?? Math.max(cameraRef.current.zoom, FLY_TO_PITCH_PX / (finestCellDeg * basePxPerDeg));
        pulseRef.current = { point: { lat, lng: normalizeLng(lng) }, until: performance.now() + 2200 };
        animateTo({ zoom: targetZoom, centerLat: lat, centerLng: normalizeLng(lng) });
        window.setTimeout(schedulePaint, 2250);
      },
      zoomIn() {
        const c = cameraRef.current;
        animateTo({ ...c, zoom: c.zoom * 1.7 }, 260);
      },
      zoomOut() {
        const c = cameraRef.current;
        animateTo({ ...c, zoom: c.zoom / 1.7 }, 260);
      },
      resetView() {
        animateTo({ zoom: 1, centerLat: 0, centerLng: 0 });
      },
      locateUser() {
        if (!navigator.geolocation) {
          onLocateErrorRef.current?.("Location is not available in this browser.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            handle.flyTo(position.coords.latitude, position.coords.longitude);
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              onLocateErrorRef.current?.("Location permission denied.");
            } else {
              onLocateErrorRef.current?.("Could not read your location.");
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
        );
      },
      invalidateSize() {
        schedulePaint();
      },
    };

    onReadyRef.current?.(handle);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const factor = Math.exp(-delta * 0.0022);
      zoomAbout(factor, event.clientX - rect.left, event.clientY - rect.top);
      updateHover(event.clientX - rect.left, event.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => paintNow()) : null;
    observer?.observe(wrap);
    paintNow();

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      observer?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      // Reset so a remount (React Strict Mode) can schedule paints again.
      frameRef.current = null;
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function localPoint(event: ReactMouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const p = localPoint(event);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer may already be gone (e.g. synthetic or cancelled); drag still works.
    }
    pointersRef.current.set(event.pointerId, p);
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      gestureRef.current = {
        kind: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: cameraRef.current.zoom,
      };
      setTooltip(null);
    } else if (pointersRef.current.size === 1) {
      gestureRef.current = {
        kind: "drag",
        startX: p.x,
        startY: p.y,
        camera: cameraRef.current,
        moved: false,
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const p = localPoint(event);
    const gesture = gestureRef.current;

    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, p);
    }

    if (gesture.kind === "pinch" && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.dist > 0) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const target = gesture.zoom * (dist / gesture.dist);
        zoomAbout(target / cameraRef.current.zoom, mid.x, mid.y);
      }
      return;
    }

    if (gesture.kind === "drag" && pointersRef.current.has(event.pointerId)) {
      const dx = p.x - gesture.startX;
      const dy = p.y - gesture.startY;
      if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      if (!gesture.moved) {
        gesture.moved = true;
        setCursor("grabbing");
        setTooltip(null);
        hoverRef.current = null;
      }
      const { pxPerDeg, cssW, cssH } = layoutRef.current;
      cameraRef.current = clampCamera(
        {
          zoom: gesture.camera.zoom,
          centerLng: gesture.camera.centerLng - dx / pxPerDeg,
          centerLat: gesture.camera.centerLat + dy / pxPerDeg,
        },
        cssW,
        cssH,
      );
      schedulePaint();
      return;
    }

    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      updateHover(p.x, p.y);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const p = localPoint(event);
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (gesture.kind === "drag") {
      if (!gesture.moved) selectAt(p.x, p.y);
      gestureRef.current = { kind: "idle" };
      setCursor("grab");
      if (event.pointerType === "mouse") updateHover(p.x, p.y);
      return;
    }

    if (gesture.kind === "pinch") {
      if (pointersRef.current.size === 1) {
        const [rest] = [...pointersRef.current.values()];
        gestureRef.current = {
          kind: "drag",
          startX: rest.x,
          startY: rest.y,
          camera: cameraRef.current,
          moved: true,
        };
      } else if (pointersRef.current.size === 0) {
        gestureRef.current = { kind: "idle" };
      }
    }
  }

  function onPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      gestureRef.current = { kind: "idle" };
      setCursor("grab");
    }
  }

  function onDoubleClick(event: ReactMouseEvent<HTMLCanvasElement>) {
    const p = localPoint(event);
    const before = screenToGeo(p.x, p.y);
    const c = cameraRef.current;
    const { cssW, cssH, basePxPerDeg } = layoutRef.current;
    const zoom = Math.min(maxZoomFor(basePxPerDeg), c.zoom * 2);
    const pxPerDeg = basePxPerDeg * zoom;
    animateTo(
      {
        zoom,
        centerLng: before.lng - (p.x - cssW / 2) / pxPerDeg,
        centerLat: before.lat + (p.y - cssH / 2) / pxPerDeg,
      },
      300,
    );
  }

  const tooltipLeft = tooltip
    ? Math.min(Math.max(8, tooltip.x + 12), Math.max(8, tooltip.maxX - 120))
    : 0;
  const tooltipTop = tooltip ? Math.max(8, tooltip.y - 36) : 0;

  return (
    <div
      ref={wrapRef}
      className="trash-map-canvas absolute inset-0 h-full w-full overflow-hidden rounded-2xl"
      role="application"
      aria-label="Trash Map world density map. Drag to pan, scroll or pinch to zoom."
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(event) => {
          if (gestureRef.current.kind === "idle") clearHover();
          else if (!pointersRef.current.has(event.pointerId)) clearHover();
        }}
        onDoubleClick={onDoubleClick}
      />
      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] px-2.5 py-1.5 text-xs text-[var(--map-fg)] shadow-md backdrop-blur-md"
          style={{ left: tooltipLeft, top: tooltipTop }}
        >
          {tooltip.label}
          {tooltip.count > 0 && (
            <span className="ml-1.5 text-[var(--map-muted)]">· tap to open</span>
          )}
        </div>
      )}
    </div>
  );
}
