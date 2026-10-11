import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_CATEGORIES, REPORT_STATUSES } from "@/lib/validation/reports";
import type { ReportFilters as Filters } from "@/lib/reports-client";
import type { ReportCategory, ReportStatus } from "@/types/reports";
import { CATEGORY_LABELS, STATUS_LABELS } from "./labels";

type ReportFiltersProps = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onRefresh: () => void;
  refreshing: boolean;
  compact?: boolean;
};

export function ReportFilters({
  filters,
  onChange,
  onRefresh,
  refreshing,
  compact = false,
}: ReportFiltersProps) {
  const selectClass = compact
    ? "h-11 rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-[var(--map-fg)] outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    : "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  const labelClass = compact ? "text-[var(--map-muted)]" : "text-muted-foreground";

  return (
    <form
      role="search"
      aria-label="Filter reports"
      className={`flex gap-3 ${compact ? "flex-col" : "flex-wrap items-end"}`}
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className={labelClass}>Status</span>
        <select
          className={selectClass}
          value={filters.status ?? ""}
          onChange={(event) =>
            onChange({ ...filters, status: (event.target.value || undefined) as ReportStatus | undefined })
          }
        >
          <option value="">All</option>
          {REPORT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className={labelClass}>Category</span>
        <select
          className={selectClass}
          value={filters.category ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              category: (event.target.value || undefined) as ReportCategory | undefined,
            })
          }
        >
          <option value="">All</option>
          {REPORT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </label>

      <Button
        type="button"
        variant="outline"
        className={
          compact
            ? "h-11 border-white/15 bg-transparent text-[var(--map-fg)] hover:bg-white/10"
            : undefined
        }
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw aria-hidden className={refreshing ? "animate-spin" : undefined} />
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
    </form>
  );
}
