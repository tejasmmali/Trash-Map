"use client";

import { useEffect, useRef, useState } from "react";
import { MapPlaceholder } from "@/components/map/map-placeholder";
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
import { ReportFilters } from "./report-filters";
import { ReportList } from "./report-list";
import { ReportSummary } from "./report-summary";

type Mode = "loading" | "live" | "demo" | "error";

type LoadedResult = FetchReportsResult & { key: string };

export function ReportsDashboard() {
  const [filters, setFilters] = useState<Filters>({});
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadedResult | null>(null);
  const [demoReports, setDemoReports] = useState<Report[]>(DEMO_REPORTS);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(new Set<string>());

  // Changing filters or pressing refresh produces a new key, which restarts
  // the list from offset 0. `loading` is derived instead of stored.
  const requestKey = `${filters.status ?? ""}|${filters.category ?? ""}|${reloadToken}`;
  const loading = result?.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetchReports(filters, 0, controller.signal).then((next) => {
      if (!controller.signal.aborted) setResult({ ...next, key: requestKey });
    });
    return () => controller.abort();
  }, [filters, requestKey]);

  const mode: Mode =
    result?.kind === "ok"
      ? "live"
      : result?.kind === "config-missing"
        ? "demo"
        : result?.kind === "error"
          ? "error"
          : "loading";

  // Live rows are already filtered by the API; re-filtering drops reports whose
  // status was just changed so live and demo mode behave the same.
  const reports =
    result?.kind === "ok"
      ? filterReports(result.reports, filters)
      : result?.kind === "config-missing"
        ? filterReports(demoReports, filters)
        : [];
  const hasMore = result?.kind === "ok" && result.pagination.has_more;
  const filtered = Boolean(filters.status || filters.category);

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
    } else {
      setErrors((prev) => ({ ...prev, [report.id]: outcome.message }));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Trash Map</h1>
          <p className="text-muted-foreground">Community-powered garbage reporting for Mumbai</p>
        </div>
        <DataSourceBadge mode={mode} />
      </header>

      {mode === "demo" && (
        <div role="status" className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm">
          <p className="font-medium">Demo mode: showing example reports</p>
          <p className="text-muted-foreground">
            The server is not connected to Supabase yet, so these are built-in examples, not real
            community submissions. Status changes only affect this browser tab and are not saved.
          </p>
        </div>
      )}

      <ReportSummary
        counts={summarizeReports(reports)}
        note={summaryNote(mode, reports.length, filtered, hasMore)}
      />

      <MapPlaceholder />

      <section aria-labelledby="reports-heading" aria-busy={loading} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="reports-heading" className="text-lg font-medium">
            Reports
          </h2>
          <ReportFilters
            filters={filters}
            onChange={changeFilters}
            onRefresh={refresh}
            refreshing={loading && result !== null}
          />
        </div>

        {result === null ? (
          <p className="text-sm text-muted-foreground">Loading reports…</p>
        ) : result.kind === "error" ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-destructive/40 p-4 text-sm">
            <p className="font-medium">Could not load reports</p>
            <p className="text-muted-foreground">{result.message}</p>
            <Button variant="outline" size="sm" onClick={refresh}>
              Try again
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
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
          <div className="flex flex-col items-center gap-2">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore || loading}>
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
            {loadMoreError && (
              <p role="alert" className="text-sm text-destructive">
                {loadMoreError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function summaryNote(mode: Mode, count: number, filtered: boolean, hasMore: boolean): string {
  if (mode === "loading") return "Loading reports…";
  if (mode === "error") return "Counts are unavailable until reports load.";
  if (mode === "demo") return "Counts cover demo reports only.";
  const scope = filtered ? " matching the current filters" : "";
  const more = hasMore ? ". More reports exist beyond this page" : "";
  return `Counts cover the ${count} loaded report${count === 1 ? "" : "s"}${scope}${more}.`;
}

const BADGES: Record<Mode, { label: string; className: string }> = {
  loading: { label: "Connecting…", className: "text-muted-foreground" },
  live: { label: "Live data", className: "border-foreground/30" },
  demo: { label: "Demo data, not saved", className: "border-dashed text-muted-foreground" },
  error: { label: "Data unavailable", className: "border-destructive/40 text-destructive" },
};

function DataSourceBadge({ mode }: { mode: Mode }) {
  const badge = BADGES[mode];
  return (
    <p className={`rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}>
      <span className="sr-only">Data source: </span>
      {badge.label}
    </p>
  );
}
