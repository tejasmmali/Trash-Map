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

/** Only http(s) or same-site paths may be rendered as links or images. */
export function safeImageUrl(url: string): string | null {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
