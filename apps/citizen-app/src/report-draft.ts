import type { MediaAsset } from "@/components/ui/media-picker";

export type ReportCategory = "roads" | "sanitation" | "water" | "lighting" | "drainage" | "other";

export type ReportLocation = { source: "current_gps"; latitude: number; longitude: number };

export type ReportDraft = {
  issue: string;
  category: ReportCategory | null;
  photo: MediaAsset | null;
  location: ReportLocation | null;
};

export const emptyReportDraft: ReportDraft = {
  issue: "",
  category: null,
  photo: null,
  location: null,
};

export const minimumIssueLength = 10;

export const reportCategories: readonly { value: ReportCategory; label: string }[] = [
  { value: "roads", label: "Roads" },
  { value: "sanitation", label: "Sanitation" },
  { value: "water", label: "Water" },
  { value: "lighting", label: "Lighting" },
  { value: "drainage", label: "Drainage" },
  { value: "other", label: "Other" },
];

export const reportDraftIssues = (draft: ReportDraft): string[] => {
  const issues: string[] = [];
  if (draft.issue.trim().length < minimumIssueLength) {
    issues.push(`Describe the issue in at least ${minimumIssueLength} characters.`);
  }
  if (!draft.photo) issues.push("Attach one photo of the issue.");
  if (!draft.location) issues.push("Capture the current location.");
  return issues;
};

export const canSubmitReportDraft = (draft: ReportDraft): boolean => reportDraftIssues(draft).length === 0;

export const formatReportCoordinates = (location: { latitude: number; longitude: number }): string =>
  `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;

export const reportCategoryLabel = (category: ReportCategory): string =>
  reportCategories.find((option) => option.value === category)?.label ?? "Other";
