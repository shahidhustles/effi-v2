import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  formatDistance,
  nearbyIssueCountLabel,
  repostAccessibilityLabel,
  repostCountLabel,
  statusLabel,
} from "./nearby-issues";

describe("nearby issue presentation", () => {
  it("formats distances for quick scanning", () => {
    expect(formatDistance(4)).toBe("10 m");
    expect(formatDistance(424)).toBe("420 m");
    expect(formatDistance(1_240)).toBe("1.2 km");
  });

  it("uses citizen-facing category and status labels", () => {
    expect(categoryLabel("sanitation")).toBe("Sanitation");
    expect(statusLabel("under_inspection")).toBe("Under inspection");
    expect(nearbyIssueCountLabel(1)).toBe("1 active issue within 3 km");
    expect(nearbyIssueCountLabel(7)).toBe("7 active issues within 3 km");
  });

  it("labels reposts for the arrow button", () => {
    expect(repostCountLabel(0)).toBe("No reposts yet");
    expect(repostCountLabel(1)).toBe("1 repost");
    expect(repostCountLabel(12)).toBe("12 reposts");
    expect(repostAccessibilityLabel(0, false)).toBe(
      "Repost this issue. No reposts yet.",
    );
    expect(repostAccessibilityLabel(3, false)).toBe(
      "Repost this issue. 3 reposts so far.",
    );
    expect(repostAccessibilityLabel(4, true)).toBe(
      "Remove your repost. 4 reposts so far.",
    );
  });
});
