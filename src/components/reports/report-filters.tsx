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
};

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ReportFilters({ filters, onChange, onRefresh, refreshing }: ReportFiltersProps) {
  return (
    <form
      role="search"
      aria-label="Filter reports"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Status</span>
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
        <span className="text-muted-foreground">Category</span>
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

      <Button type="button" variant="outline" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw aria-hidden className={refreshing ? "animate-spin" : undefined} />
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
    </form>
  );
}
