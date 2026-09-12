import { describe, expect, it } from "vitest";
import type { CaseDetail } from "./case-detail-types";
import { shouldShowAssignmentNotice } from "./case-actions";

const resolvedCase = {
  reportId: "report-1",
  reportNumber: "RPT-1",
  summary: "Resolved drainage issue.",
  category: "drainage",
  location: { source: "current_gps", latitude: 3.139, longitude: 101.6869 },
  reportedAt: 1,
  submittedAt: 2,
  recommendedPriority: "high",
  currentPriority: "medium",
  priorityReasons: [],
  citations: [],
  acceptedEvidence: [],
  channel: "telegram",
  conversationId: "conversation-1",
  status: "resolved",
  assignment: { officerName: "Shahid Patel" },
  canAct: false,
} satisfies CaseDetail["case"];

describe("CaseActions", () => {
  it("shows only the completion notice for a resolved case", () => {
    expect(shouldShowAssignmentNotice(resolvedCase)).toBe(false);
  });
});
