import type { ReportCategory, ReportStatus } from "@/types/reports";

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  plastic: "Plastic",
  organic: "Organic",
  construction: "Construction",
  mixed: "Mixed",
  other: "Other",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
