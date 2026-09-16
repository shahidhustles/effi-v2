import { describe, expect, it } from "vitest";
import { buildOperationalAnalytics, calculateSlaState, type AnalyticsCase } from "./analytics-state";

const hour = 60 * 60 * 1000;
const now = new Date(2026, 8, 16, 12).getTime();

const makeCase = (overrides: Partial<AnalyticsCase> = {}): AnalyticsCase => ({
  caseId: "case-1",
  reportNumber: "RPT-1",
  summary: "Broken streetlight outside the clinic",
  category: "lighting",
  channel: "app",
  status: "new",
  recommendedPriority: "high",
  currentPriority: "high",
  submittedAt: now - 8 * hour,
  location: { source: "current_gps", latitude: 18.5204, longitude: 73.8567, place: { name: "Central Clinic", formattedAddress: "Central Clinic" } },
  repostCount: 0,
  audit: [],
  ...overrides,
});

describe("operational analytics", () => {
  it("marks a supported open case as at risk after 75 percent of its working-time target", () => {
    const mondayAtEight = new Date(2026, 8, 14, 8).getTime();
    const mondayAtFour = new Date(2026, 8, 14, 16).getTime();
    const state = calculateSlaState(makeCase({ submittedAt: mondayAtEight }), mondayAtFour);
    expect(state).toMatchObject({ kind: "tracked", risk: "at_risk", consumedPercent: 80 });
  });

  it("does not invent SLA status for an unsupported service category", () => {
    expect(calculateSlaState(makeCase({ category: "water" }), now)).toEqual({ kind: "unavailable" });
    expect(calculateSlaState(makeCase({ category: "sanitation", currentPriority: "medium" }), now)).toEqual({ kind: "unavailable" });
  });

  it("builds recurrence and human-override signals from real case fields", () => {
    const cases = [
      makeCase({ caseId: "case-1", currentPriority: "critical", repostCount: 3 }),
      makeCase({ caseId: "case-2", reportNumber: "RPT-2", location: { source: "selected_pin", latitude: 18.521, longitude: 73.857 }, repostCount: 1 }),
      makeCase({ caseId: "case-3", reportNumber: "RPT-3", category: "roads", location: { source: "current_gps", latitude: 19, longitude: 74 }, currentPriority: "medium" }),
    ];
    const result = buildOperationalAnalytics({ cases, now, period: 30, category: "all" });
    expect(result.recurrenceClusters[0]).toMatchObject({ category: "lighting", caseCount: 2, repostCount: 4 });
    expect(result.priorityAgreement).toEqual({ unchanged: 1, raised: 1, lowered: 1 });
  });

  it("derives median stage timings from audit events", () => {
    const assignedAt = now - 6 * hour;
    const resolvedAt = now - hour;
    const completed = makeCase({
      status: "resolved",
      submittedAt: now - 8 * hour,
      audit: [
        { occurredAt: assignedAt, event: { kind: "status_changed", from: "new", to: "assigned" } },
        { occurredAt: now - 5 * hour, event: { kind: "status_changed", from: "assigned", to: "under_inspection" } },
        { occurredAt: now - 3 * hour, event: { kind: "status_changed", from: "under_inspection", to: "work_in_progress" } },
        { occurredAt: resolvedAt, event: { kind: "case_resolved", from: "work_in_progress", to: "resolved", resolutionNote: "Lamp replaced." } },
      ],
    });
    const result = buildOperationalAnalytics({ cases: [completed], now, period: 7, category: "all" });
    expect(result.medianAssignmentMs).toBe(2 * hour);
    expect(result.medianResolutionMs).toBe(7 * hour);
    expect(result.flow.map((stage) => stage.count)).toEqual([1, 1, 1, 1, 1]);
  });
});
