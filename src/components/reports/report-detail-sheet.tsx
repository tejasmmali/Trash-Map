"use client";

import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_STATUSES } from "@/lib/validation/reports";
import type { Report, ReportStatus } from "@/types/reports";
import { CATEGORY_LABELS, STATUS_LABELS, formatDate } from "./labels";

type ReportDetailSheetProps = {
  reports: Report[];
  open: boolean;
  updatingIds: ReadonlySet<string>;
  errors: Readonly<Record<string, string>>;
  onClose: () => void;
  onStatusChange: (report: Report, status: ReportStatus) => void;
  onOpenList?: () => void;
};

export function ReportDetailSheet({
  reports,
  open,
  updatingIds,
  errors,
  onClose,
  onStatusChange,
  onOpenList,
}: ReportDetailSheetProps) {
  if (!open || reports.length === 0) return null;

  const primary = reports[0];

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[22rem]"
      role="dialog"
      aria-modal="false"
      aria-labelledby="report-detail-title"
    >
      <div className="max-h-[min(70vh,32rem)] overflow-auto rounded-t-2xl border border-white/10 bg-[color-mix(in_oklch,var(--map-panel)_96%,transparent)] p-4 shadow-xl backdrop-blur-md sm:rounded-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--map-muted)]">
              {reports.length > 1 ? `${reports.length} reports in this area` : "Report details"}
            </p>
            <h2 id="report-detail-title" className="text-base font-semibold text-[var(--map-fg)]">
              {CATEGORY_LABELS[primary.category]}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-[var(--map-fg)] hover:bg-white/10"
            aria-label="Close report details"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>

        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-xl border border-white/10 bg-black/10 p-3"
            >
              <div className="mb-2 overflow-hidden rounded-lg bg-black/20">
                <img
                  src={report.image_url}
                  alt=""
                  className="h-28 w-full object-cover"
                />
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-[var(--map-fg)]">
                  {CATEGORY_LABELS[report.category]}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-[var(--map-fg)]">
                  {STATUS_LABELS[report.status]}
                </span>
                {report.is_sample && (
                  <span className="rounded-md border border-dashed border-white/25 px-2 py-0.5 text-xs text-[var(--map-muted)]">
                    Sample data
                  </span>
                )}
              </div>

              <p className="mb-2 text-sm text-[var(--map-fg)]">
                {report.description ?? "No description provided."}
              </p>

              <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-[var(--map-muted)]">
                <dt>Location</dt>
                <dd className="tabular-nums">
                  {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                </dd>
                <dt>Reported</dt>
                <dd>
                  <time dateTime={report.created_at}>{formatDate(report.created_at)}</time>
                </dd>
                {report.resolved_at && (
                  <>
                    <dt>Resolved</dt>
                    <dd>
                      <time dateTime={report.resolved_at}>{formatDate(report.resolved_at)}</time>
                    </dd>
                  </>
                )}
              </dl>

              <div className="flex flex-wrap gap-2">
                {REPORT_STATUSES.filter((status) => status !== report.status).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant="outline"
                    className="border-white/15 bg-transparent text-[var(--map-fg)] hover:bg-white/10"
                    disabled={updatingIds.has(report.id)}
                    onClick={() => onStatusChange(report, status)}
                  >
                    Mark {STATUS_LABELS[status].toLowerCase()}
                  </Button>
                ))}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=18/${report.latitude}/${report.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[0.8rem] text-[var(--map-fg)] underline-offset-2 hover:underline"
                >
                  Open map
                  <ExternalLink aria-hidden className="size-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>

              <p aria-live="polite" className="mt-2 text-xs">
                {updatingIds.has(report.id) && (
                  <span className="text-[var(--map-muted)]">Updating…</span>
                )}
                {!updatingIds.has(report.id) && errors[report.id] && (
                  <span className="text-red-300">{errors[report.id]}</span>
                )}
              </p>
            </li>
          ))}
        </ul>

        {onOpenList && (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full text-[var(--map-fg)] hover:bg-white/10"
            onClick={onOpenList}
          >
            View all reports
          </Button>
        )}
      </div>
    </div>
  );
}
