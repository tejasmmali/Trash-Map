import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { REPORT_STATUSES } from "@/lib/validation/reports";
import type { Report, ReportStatus } from "@/types/reports";
import { CATEGORY_LABELS, STATUS_LABELS, formatDate, safeImageUrl } from "./labels";

type ReportListProps = {
  reports: Report[];
  updatingIds: ReadonlySet<string>;
  errors: Readonly<Record<string, string>>;
  onStatusChange: (report: Report, status: ReportStatus) => void;
};

export function ReportList({ reports, updatingIds, errors, onStatusChange }: ReportListProps) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {reports.map((report) => (
        <li key={report.id}>
          <ReportCard
            report={report}
            updating={updatingIds.has(report.id)}
            error={errors[report.id]}
            onStatusChange={onStatusChange}
          />
        </li>
      ))}
    </ul>
  );
}

type ReportCardProps = {
  report: Report;
  updating: boolean;
  error?: string;
  onStatusChange: (report: Report, status: ReportStatus) => void;
};

function ReportCard({ report, updating, error, onStatusChange }: ReportCardProps) {
  const headingId = `report-${report.id}`;
  const imageUrl = safeImageUrl(report.image_url);
  const osmUrl = `https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=18/${report.latitude}/${report.longitude}`;

  return (
    <article
      aria-labelledby={headingId}
      aria-busy={updating}
      className="flex h-full flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={headingId} className="font-medium">
          {CATEGORY_LABELS[report.category]}
        </h3>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{STATUS_LABELS[report.status]}</span>
        {report.is_sample && (
          <span className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
            Sample data
          </span>
        )}
      </header>

      <div className="flex gap-3">
        {imageUrl && (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Image src={imageUrl} alt="" fill unoptimized sizes="80px" className="object-cover" />
            <span className="sr-only">Open photo (opens in a new tab)</span>
          </a>
        )}
        <p className="text-sm">{report.description ?? "No description provided."}</p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dt>Location</dt>
        <dd className="tabular-nums">
          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}{" "}
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            OpenStreetMap
            <ExternalLink aria-hidden className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
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

      <div className="mt-auto flex flex-col gap-2">
        <div role="group" aria-label="Change status" className="flex flex-wrap gap-2">
          {REPORT_STATUSES.filter((status) => status !== report.status).map((status) => (
            <Button
              key={status}
              size="sm"
              variant="outline"
              disabled={updating}
              onClick={() => onStatusChange(report, status)}
            >
              Mark {STATUS_LABELS[status].toLowerCase()}
            </Button>
          ))}
        </div>
        <p aria-live="polite" className="text-xs">
          {updating && <span className="text-muted-foreground">Updating…</span>}
          {!updating && error && <span className="text-destructive">{error}</span>}
        </p>
      </div>
    </article>
  );
}
