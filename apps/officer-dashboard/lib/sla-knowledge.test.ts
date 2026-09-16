import { describe, expect, it } from "vitest";
import { manualPageToText, parseSlaManual } from "./sla-knowledge";

const validManual = {
  documentKey: "manual",
  title: "Manual",
  subtitle: "Demo",
  version: "1.0",
  effectiveDate: "2026-09-16",
  disclaimer: "Demo only.",
  pages: [{
    pageNumber: 1,
    category: "potholes",
    heading: "Potholes",
    summary: "Road repair rules.",
    sections: [{ title: "Targets", bullets: ["Repair within five working days."] }],
  }],
};

describe("SLA manual parsing", () => {
  it("parses consecutive pages and produces self-contained page text", () => {
    const manual = parseSlaManual(validManual);
    const firstPage = manual.pages[0];
    expect(firstPage?.category).toBe("potholes");
    if (!firstPage) throw new Error("Expected a parsed page.");
    expect(manualPageToText(manual, firstPage)).toContain("version 1.0");
    expect(manualPageToText(manual, firstPage)).toContain("Repair within five working days.");
  });

  it("rejects page gaps before ingestion", () => {
    expect(() => parseSlaManual({
      ...validManual,
      pages: [{ ...validManual.pages[0], pageNumber: 2 }],
    })).toThrow("Expected page 1");
  });
});
