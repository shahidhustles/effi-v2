import { describe, expect, it } from "vitest";
import {
  canSubmitReportDraft,
  emptyReportDraft,
  formatReportCoordinates,
  reportCategoryLabel,
  reportDraftIssues,
  type ReportDraft,
} from "./report-draft";

const completeDraft: ReportDraft = {
  issue: "The drain outside 12 Jalan Mawar is blocked and flooding the road.",
  category: "drainage",
  photo: { id: "photo-1", uri: "file:///photo.jpg", type: "image" },
  location: { source: "current_gps", latitude: 3.139, longitude: 101.6869 },
};

describe("report draft", () => {
  it("lists every missing part of an empty draft", () => {
    expect(reportDraftIssues(emptyReportDraft)).toHaveLength(3);
    expect(canSubmitReportDraft(emptyReportDraft)).toBe(false);
  });

  it("accepts a complete draft", () => {
    expect(reportDraftIssues(completeDraft)).toEqual([]);
    expect(canSubmitReportDraft(completeDraft)).toBe(true);
  });

  it("rejects a draft whose issue is too short", () => {
    const draft = { ...completeDraft, issue: "Short" };
    expect(canSubmitReportDraft(draft)).toBe(false);
    expect(reportDraftIssues(draft)).toContain("Describe the issue in at least 10 characters.");
  });

  it("formats coordinates and category labels for review", () => {
    expect(formatReportCoordinates(completeDraft.location!)).toBe("3.13900, 101.68690");
    expect(reportCategoryLabel("drainage")).toBe("Drainage");
  });
});
