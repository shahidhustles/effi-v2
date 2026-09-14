import { describe, expect, it } from "vitest";
import { formatDisplayLocation, formatReportNumber } from "./report-display";

describe("citizen report display", () => {
  it("keeps short report numbers and shortens long storage-backed numbers", () => {
    expect(formatReportNumber("RPT-0028")).toBe("RPT-0028");
    expect(formatReportNumber("RPT-k57abc123456789xyz")).toBe("RPT-…789xyz");
  });

  it("shows readable places without exposing coordinates", () => {
    expect(formatDisplayLocation({
      latitude: 12.9716,
      longitude: 77.5946,
      place: { name: "Cubbon Park, Bengaluru", formattedAddress: "Cubbon Park, Bengaluru, Karnataka" },
    })).toBe("Cubbon Park, Bengaluru");
    expect(formatDisplayLocation({ latitude: 12.9716, longitude: 77.5946 })).toBe("Pinned location");
  });
});
