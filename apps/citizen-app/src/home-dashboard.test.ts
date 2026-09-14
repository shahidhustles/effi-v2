import { describe, expect, it } from "vitest";
import {
  citizenFirstName,
  countHomeOverview,
  formatHomeRelativeTime,
  greetingForHour,
  recentCitizenCases,
  type CitizenCaseSummary,
} from "./home-dashboard";

const makeCase = (
  status: CitizenCaseSummary["status"],
  submittedAt: number,
): CitizenCaseSummary => ({
  caseId: `${status}-${submittedAt}`,
  reportNumber: `RPT-${submittedAt}`,
  summary: `${status} report`,
  category: "roads",
  status,
  submittedAt,
  location: { latitude: 12.9716, longitude: 77.5946 },
});

describe("citizen home dashboard", () => {
  it("maps the five case states into the four approved overview metrics", () => {
    const cases = [
      makeCase("new", 5),
      makeCase("assigned", 4),
      makeCase("under_inspection", 3),
      makeCase("work_in_progress", 2),
      makeCase("resolved", 1),
    ];

    expect(countHomeOverview(cases)).toEqual({
      submitted: 5,
      assigned: 1,
      inProgress: 2,
      resolved: 1,
    });
  });

  it("keeps only the three newest cases returned by Convex", () => {
    const cases = [
      makeCase("new", 3),
      makeCase("assigned", 2),
      makeCase("resolved", 1),
      makeCase("resolved", 0),
    ];

    expect(recentCitizenCases(cases).map((entry) => entry.submittedAt)).toEqual([3, 2, 1]);
  });

  it("uses the Clerk first name and falls back safely", () => {
    expect(citizenFirstName({ firstName: " Shahid ", username: "spatel" })).toBe("Shahid");
    expect(citizenFirstName({ firstName: null, username: "spatel" })).toBe("spatel");
    expect(citizenFirstName(null)).toBe("Citizen");
  });

  it("uses the approved morning and evening greeting split", () => {
    expect(greetingForHour(11)).toBe("Good morning");
    expect(greetingForHour(12)).toBe("Good evening");
  });

  it("formats relative time", () => {
    const now = Date.UTC(2026, 8, 13, 12);
    expect(formatHomeRelativeTime(now - 2 * 60 * 60 * 1000, now)).toBe("2h ago");
  });
});
