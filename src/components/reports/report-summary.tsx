import type { ReportCounts } from "@/lib/reports-client";

type ReportSummaryProps = {
  counts: ReportCounts;
  note: string;
};

const ITEMS: { key: keyof ReportCounts; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
];

export function ReportSummary({ counts, note }: ReportSummaryProps) {
  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-2">
      <h2 id="summary-heading" className="sr-only">
        Report summary
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ITEMS.map(({ key, label }) => (
          <div key={key} className="rounded-lg border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{counts[key]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">{note}</p>
    </section>
  );
}
