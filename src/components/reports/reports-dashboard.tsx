"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Filter, List, Menu, Plus, RefreshCw, X } from "lucide-react";
import { MapControls } from "@/components/map/map-controls";
import { MapLegend } from "@/components/map/map-legend";
import { MapSearch } from "@/components/map/map-search";
import { TrashMap, type MapViewHandle } from "@/components/map/trash-map";
import type { MapLayerMode } from "@/components/map/map-constants";
import { Button } from "@/components/ui/button";
import { DEMO_REPORTS } from "@/lib/demo-reports";
import {
  applyDemoStatus,
  fetchReports,
  filterReports,
  summarizeReports,
  updateReportStatus,
  type FetchReportsResult,
  type ReportFilters as Filters,
} from "@/lib/reports-client";
import type { Report, ReportStatus } from "@/types/reports";
import { ReportDetailSheet } from "./report-detail-sheet";
import { ReportFilters } from "./report-filters";
import { ReportList } from "./report-list";
import { ReportWasteSheet } from "./report-waste-sheet";

type Mode = "loading" | "live" | "demo" | "error";
type LoadedResult = FetchReportsResult & { key: string };
type Panel = "none" | "filters" | "list" | "menu";

export function ReportsDashboard() {
  const [filters, setFilters] = useState<Filters>({});
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadedResult | null>(null);
  const [demoReports, setDemoReports] = useState<Report[]>(DEMO_REPORTS);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [layer, setLayer] = useState<MapLayerMode>("density");
  const [layersOpen, setLayersOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [selectedReports, setSelectedReports] = useState<Report[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const mapHandle = useRef<MapViewHandle | null>(null);
  const inFlight = useRef(new Set<string>());

  const requestKey = `${filters.status ?? ""}|${filters.category ?? ""}|${reloadToken}`;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetchReports(filters, 0, controller.signal).then((next) => {
      if (!controller.signal.aborted) setResult({ ...next, key: requestKey });
    });
    return () => controller.abort();
  }, [filters, requestKey]);

  useEffect(() => {
    if (!locateMessage) return;
    const timer = window.setTimeout(() => setLocateMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [locateMessage]);

  const mode: Mode =
    result?.kind === "ok"
      ? "live"
      : result?.kind === "config-missing"
        ? "demo"
        : result?.kind === "error"
          ? "error"
          : "loading";

  const reports =
    result?.kind === "ok"
      ? filterReports(result.reports, filters)
      : result?.kind === "config-missing"
        ? filterReports(demoReports, filters)
        : [];
  const hasMore = result?.kind === "ok" && result.pagination.has_more;
  const filtered = Boolean(filters.status || filters.category);
  const counts = summarizeReports(reports);
  const selectedId = selectedReports[0]?.id ?? null;

  function changeFilters(next: Filters) {
    setFilters(next);
    setLoadMoreError(null);
    setErrors({});
  }

  function refresh() {
    setReloadToken((token) => token + 1);
    setLoadMoreError(null);
    setErrors({});
  }

  async function loadMore() {
    if (result?.kind !== "ok" || loadingMore) return;
    const key = result.key;
    setLoadingMore(true);
    setLoadMoreError(null);
    const next = await fetchReports(filters, result.reports.length);
    setLoadingMore(false);
    if (next.kind !== "ok") {
      setLoadMoreError(next.kind === "error" ? next.message : "Could not load more reports.");
      return;
    }
    setResult((prev) => {
      if (prev?.kind !== "ok" || prev.key !== key) return prev;
      const seen = new Set(prev.reports.map((report) => report.id));
      return {
        ...prev,
        reports: [...prev.reports, ...next.reports.filter((report) => !seen.has(report.id))],
        pagination: next.pagination,
      };
    });
  }

  async function changeStatus(report: Report, status: ReportStatus) {
    if (inFlight.current.has(report.id)) return;

    if (mode === "demo") {
      const now = new Date().toISOString();
      setDemoReports((prev) =>
        prev.map((item) => (item.id === report.id ? applyDemoStatus(item, status, now) : item)),
      );
      setSelectedReports((prev) =>
        prev.map((item) => (item.id === report.id ? applyDemoStatus(item, status, now) : item)),
      );
      return;
    }

    inFlight.current.add(report.id);
    setUpdatingIds(new Set(inFlight.current));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[report.id];
      return next;
    });

    const outcome = await updateReportStatus(report.id, status);

    inFlight.current.delete(report.id);
    setUpdatingIds(new Set(inFlight.current));
    if (outcome.ok) {
      setResult((prev) =>
        prev?.kind === "ok"
          ? {
              ...prev,
              reports: prev.reports.map((item) => (item.id === report.id ? outcome.report : item)),
            }
          : prev,
      );
      setSelectedReports((prev) =>
        prev.map((item) => (item.id === report.id ? outcome.report : item)),
      );
    } else {
      setErrors((prev) => ({ ...prev, [report.id]: outcome.message }));
    }
  }

  function togglePanel(next: Panel) {
    setPanel((current) => (current === next ? "none" : next));
    setLayersOpen(false);
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--map-bg)] text-[var(--map-fg)]">
      <header className="z-40 shrink-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] px-3 py-2 shadow-sm backdrop-blur-md sm:flex-none sm:px-4">
              <p className="truncate text-base font-semibold tracking-tight sm:text-lg">Trash Map</p>
            </div>

            <div className="hidden min-w-0 flex-1 sm:block">
              <MapSearch
                onSelectPlace={(place) => mapHandle.current?.flyTo(place.lat, place.lng)}
              />
            </div>

            <Button
              type="button"
              className="hidden h-11 bg-[var(--map-accent)] px-4 text-[var(--map-accent-fg)] hover:bg-[var(--map-accent)]/90 sm:inline-flex"
              onClick={() => setReportOpen(true)}
            >
              <Plus />
              Report waste
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] text-[var(--map-fg)] shadow-sm backdrop-blur-md hover:bg-white/10"
              aria-label="Open menu"
              aria-expanded={panel === "menu"}
              onClick={() => togglePanel("menu")}
            >
              {panel === "menu" ? <X /> : <Menu />}
            </Button>
          </div>

          <div className="sm:hidden">
            <MapSearch
              onSelectPlace={(place) => mapHandle.current?.flyTo(place.lat, place.lng)}
            />
          </div>
        </div>
      </header>

      <div className="mx-3 mb-2 shrink-0 sm:mx-auto sm:mb-3 sm:w-full sm:max-w-3xl sm:px-4">
        <div className="relative h-[min(36vh,16.5rem)] rounded-2xl border border-white/10 bg-[var(--map-bg)] sm:h-[min(40vh,22rem)]">
          <TrashMap
            reports={reports}
            layer={layer}
            selectedId={selectedId}
            onSelectReports={(next) => {
              setSelectedReports(next);
              setPanel("none");
            }}
            onReady={(handle) => {
              mapHandle.current = handle;
            }}
            onLocateError={setLocateMessage}
          />

          <div className="pointer-events-none absolute inset-x-0 top-2 z-30 px-2">
            <div className="pointer-events-none max-w-[14rem]">
              {(mode === "demo" || mode === "error" || loading) && (
                <div
                  role="status"
                  className="pointer-events-auto rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] px-3 py-2 text-xs text-[var(--map-muted)] shadow-sm backdrop-blur-md"
                >
                  {mode === "demo" && "Demo data, not saved"}
                  {mode === "error" && "Could not load reports"}
                  {mode === "loading" && "Loading reports…"}
                  {mode === "live" && loading && "Refreshing…"}
                </div>
              )}
              {locateMessage && (
                <p
                  role="status"
                  className="pointer-events-auto mt-2 rounded-xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_94%,transparent)] px-3 py-2 text-xs text-[var(--map-muted)] shadow-sm backdrop-blur-md"
                >
                  {locateMessage}
                </p>
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-2 left-2 z-30">
            <MapLegend />
          </div>

          <div className="pointer-events-auto absolute bottom-2 right-2 z-30">
            <MapControls
              layer={layer}
              layersOpen={layersOpen}
              onToggleLayers={() => {
                setLayersOpen((open) => !open);
                setPanel("none");
              }}
              onLayerChange={(next) => {
                setLayer(next);
                setLayersOpen(false);
              }}
              onLocate={() => mapHandle.current?.locateUser()}
              onZoomIn={() => mapHandle.current?.zoomIn()}
              onZoomOut={() => mapHandle.current?.zoomOut()}
            />
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="px-3 pb-2 text-xs text-[var(--map-muted)] sm:px-4">
          <span className="font-medium text-[var(--map-fg)]">{counts.total}</span> loaded
          {filtered ? " · filtered" : ""} · warm dots show trash heat · drag, pinch, or scroll to zoom
        </div>

        <ReportDetailSheet
          reports={selectedReports}
          open={selectedReports.length > 0 && panel === "none"}
          updatingIds={updatingIds}
          errors={errors}
          onClose={() => setSelectedReports([])}
          onStatusChange={changeStatus}
          onOpenList={() => {
            setSelectedReports([]);
            setPanel("list");
          }}
        />

        {panel === "filters" && (
          <SidePanel title="Filters" onClose={() => setPanel("none")}>
            <ReportFilters
              filters={filters}
              onChange={changeFilters}
              onRefresh={refresh}
              refreshing={loading && result !== null}
              compact
            />
          </SidePanel>
        )}

        {panel === "list" && (
          <SidePanel title="Reports" onClose={() => setPanel("none")} wide>
            {result === null ? (
              <p className="text-sm text-[var(--map-muted)]">Loading reports…</p>
            ) : result.kind === "error" ? (
              <div role="alert" className="flex flex-col items-start gap-2 text-sm">
                <p className="font-medium text-[var(--map-fg)]">Could not load reports</p>
                <p className="text-[var(--map-muted)]">{result.message}</p>
                <Button variant="outline" size="sm" onClick={refresh}>
                  Try again
                </Button>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-[var(--map-muted)]">
                {filtered ? "No reports match these filters." : "No reports yet."}
              </p>
            ) : (
              <ReportList
                reports={reports}
                updatingIds={updatingIds}
                errors={errors}
                onStatusChange={changeStatus}
              />
            )}
            {hasMore && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore || loading}>
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
                {loadMoreError && (
                  <p role="alert" className="text-sm text-red-300">
                    {loadMoreError}
                  </p>
                )}
              </div>
            )}
          </SidePanel>
        )}

        {panel === "menu" && (
          <SidePanel title="Menu" onClose={() => setPanel("none")}>
            <div className="flex flex-col gap-2">
              <MenuButton
                icon={<List className="size-4" />}
                label="All reports"
                onClick={() => setPanel("list")}
              />
              <MenuButton
                icon={<Filter className="size-4" />}
                label="Filters"
                onClick={() => setPanel("filters")}
              />
              <MenuButton
                icon={<RefreshCw className="size-4" />}
                label={loading && result !== null ? "Refreshing…" : "Refresh data"}
                onClick={() => {
                  refresh();
                  setPanel("none");
                }}
              />
              <p className="mt-2 text-xs text-[var(--map-muted)]">
                {mode === "demo"
                  ? "Demo reports only. Status changes stay in this tab."
                  : mode === "live"
                    ? `Showing ${counts.total} loaded report${counts.total === 1 ? "" : "s"}.`
                    : mode === "error"
                      ? "Data unavailable until reports load."
                      : "Connecting…"}
              </p>
            </div>
          </SidePanel>
        )}
      </div>

      <nav
        aria-label="Primary"
        className="z-20 grid grid-cols-3 gap-2 border-t border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_96%,transparent)] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden"
      >
        <Button
          type="button"
          variant="ghost"
          className="h-11 flex-col gap-0.5 text-[0.7rem] text-[var(--map-fg)] hover:bg-white/10"
          aria-pressed={panel === "filters"}
          onClick={() => togglePanel("filters")}
        >
          <Filter className="size-4" />
          Filters
        </Button>
        <Button
          type="button"
          className="h-11 bg-[var(--map-accent)] text-[var(--map-accent-fg)] hover:bg-[var(--map-accent)]/90"
          onClick={() => setReportOpen(true)}
        >
          <Plus />
          Report
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 flex-col gap-0.5 text-[0.7rem] text-[var(--map-fg)] hover:bg-white/10"
          aria-pressed={panel === "list"}
          onClick={() => togglePanel("list")}
        >
          <List className="size-4" />
          List
        </Button>
      </nav>

      {reportOpen && (
        <ReportWasteSheet open onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}

function SidePanel({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:top-24">
      <div
        className={`flex max-h-[min(75vh,36rem)] flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_96%,transparent)] shadow-xl backdrop-blur-md sm:max-h-full sm:rounded-2xl ${
          wide ? "sm:w-[28rem]" : "sm:w-[22rem]"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold text-[var(--map-fg)]">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-[var(--map-fg)] hover:bg-white/10"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-11 items-center gap-3 rounded-xl border border-white/10 px-3 text-sm text-[var(--map-fg)] hover:bg-white/10"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
