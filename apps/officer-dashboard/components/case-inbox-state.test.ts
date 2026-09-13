import { describe, expect, it } from "vitest";
import { countWorkload, filterCases, formatRelativeTime, sortCases, type CaseSummary } from "./case-inbox-state";

function makeCase(overrides: Partial<CaseSummary> & { caseId: string }): CaseSummary {
  return {
    reportId: `report_${overrides.caseId}`,
    reportNumber: `EF-${overrides.caseId}`,
    summary: "Overflowing bin on the corner",
    category: "sanitation",
    status: "new",
    currentPriority: "medium",
    reportedAt: 1_000_000,
    submittedAt: 1_000_000,
    channel: "telegram",
    isAssignedToMe: false,
    ...overrides,
  };
}

const noFilters = { statuses: [], priorities: [] };

describe("case inbox state", () => {
  it("keeps every case when no filters are active", () => {
    const cases = [makeCase({ caseId: "a" }), makeCase({ caseId: "b", status: "resolved" })];
    expect(filterCases(cases, noFilters)).toHaveLength(2);
  });

  it("matches any selected status, any selected priority, and combines the two groups", () => {
    const cases = [
      makeCase({ caseId: "a", status: "new", currentPriority: "low" }),
      makeCase({ caseId: "b", status: "assigned", currentPriority: "high" }),
      makeCase({ caseId: "c", status: "resolved", currentPriority: "critical" }),
    ];

    const statusesOnly = filterCases(cases, { statuses: ["new", "assigned"], priorities: [] });
    expect(statusesOnly.map((entry) => entry.caseId)).toEqual(["a", "b"]);

    const prioritiesOnly = filterCases(cases, { statuses: [], priorities: ["critical"] });
    expect(prioritiesOnly.map((entry) => entry.caseId)).toEqual(["c"]);

    const combined = filterCases(cases, { statuses: ["new", "assigned"], priorities: ["high", "critical"] });
    expect(combined.map((entry) => entry.caseId)).toEqual(["b"]);
  });

  it("sorts by submitted time without mutating the input", () => {
    const cases = [
      makeCase({ caseId: "old", submittedAt: 100 }),
      makeCase({ caseId: "new", submittedAt: 300 }),
      makeCase({ caseId: "middle", submittedAt: 200 }),
    ];
    expect(sortCases(cases, "newest").map((entry) => entry.caseId)).toEqual(["new", "middle", "old"]);
    expect(sortCases(cases, "oldest").map((entry) => entry.caseId)).toEqual(["old", "middle", "new"]);
    expect(cases.map((entry) => entry.caseId)).toEqual(["old", "new", "middle"]);
  });

  it("counts open cases, new cases, urgent priorities, and resolved cases", () => {
    const counts = countWorkload([
      makeCase({ caseId: "a", status: "new", currentPriority: "critical" }),
      makeCase({ caseId: "b", status: "work_in_progress", currentPriority: "high" }),
      makeCase({ caseId: "c", status: "resolved", currentPriority: "low" }),
      makeCase({ caseId: "d", status: "assigned", currentPriority: "medium" }),
    ]);
    expect(counts).toEqual({ open: 3, fresh: 1, urgent: 2, resolved: 1 });
  });

  it("formats recent timestamps and falls back to a date for older cases", () => {
    const now = 1_000_000_000;
    expect(formatRelativeTime(now - 30_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2d ago");
    expect(formatRelativeTime(now - 10 * 24 * 60 * 60_000, now)).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});
