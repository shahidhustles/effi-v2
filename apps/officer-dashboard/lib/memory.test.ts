import { describe, expect, it } from "vitest";
import { buildMemoryContext, caseMemoryUserId, officerMemoryUserId, type MemoryRecord } from "./memory";

describe("memory user ids", () => {
  it("scopes officer memories by clerk id", () => {
    expect(officerMemoryUserId("user_abc")).toBe("officer_user_abc");
  });

  it("scopes case memories by case id", () => {
    expect(caseMemoryUserId("case_123")).toBe("case_case_123");
  });
});

describe("buildMemoryContext", () => {
  it("returns empty string when there are no memories", () => {
    expect(buildMemoryContext([])).toBe("");
  });

  it("renders one bullet per memory with the case-data-wins caveat", () => {
    const records: MemoryRecord[] = [
      { id: "m1", text: "Officer prefers concise answers", updatedAt: null },
      { id: "m2", text: "Witness statement was corrected on Sep 10", updatedAt: null },
    ];
    const block = buildMemoryContext(records);
    expect(block).toContain("- Officer prefers concise answers");
    expect(block).toContain("- Witness statement was corrected on Sep 10");
    expect(block).toContain("Case data below always wins over memories for case facts.");
  });
});
