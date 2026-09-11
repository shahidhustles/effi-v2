import { describe, expect, it } from "vitest";
import { nextCaseStatus, transitionCase } from "../src/index.js";

describe("transitionCase", () => {
  it("records allowed transitions", () => expect(transitionCase("new", "assigned", "2026-08-18T00:00:00.000Z").to).toBe("assigned"));
  it("rejects invalid transitions", () => expect(() => transitionCase("new", "resolved", "2026-08-18T00:00:00.000Z")).toThrow("Invalid case status transition"));
  it("returns the next status and stops at resolved", () => {
    expect(nextCaseStatus("assigned")).toBe("under_inspection");
    expect(nextCaseStatus("resolved")).toBeNull();
  });
});
