import { describe, expect, it } from "vitest";
import { interpretationConfirmationText } from "../agent/tools/record_report_interpretation.js";

describe("record_report_interpretation model output", () => {
  it("contains only the citizen-facing confirmation block", () => {
    expect(interpretationConfirmationText({
      issue: "I have a pothole on my main road",
      category: "roads",
      coordinates: { latitude: 18.618247, longitude: 73.776219 },
      acceptedPhotos: 1,
    })).toBe([
      "Issue: I have a pothole on my main road",
      "Category: roads",
      "Coordinates: 18.618247, 73.776219",
      "Accepted photos: 1",
      "Is this correct?",
    ].join("\n"));
  });
});
