import { describe, expect, it } from "vitest";
import { safeImageUrl } from "@/components/reports/labels";

describe("safeImageUrl", () => {
  it("allows https, http, and same-site paths", () => {
    const supabase = "https://x.supabase.co/storage/v1/object/public/report-images/reports/a.jpg";
    expect(safeImageUrl(supabase)).toBe(supabase);
    expect(safeImageUrl("http://localhost:3000/a.png")).toBe("http://localhost:3000/a.png");
    expect(safeImageUrl("/samples/sample-report.svg")).toBe("/samples/sample-report.svg");
  });

  it.each(["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<script>", "//evil.example/x.png", "not a url"])(
    "rejects %s",
    (url) => {
      expect(safeImageUrl(url)).toBeNull();
    },
  );
});
