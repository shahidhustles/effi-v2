import { describe, expect, it } from "vitest";
import { transitionCase } from "../src/index.js";

describe("transitionCase", () => {
  it("records allowed transitions", () => expect(transitionCase("new", "assigned", "2026-08-18T00:00:00.000Z").to).toBe("assigned"));
  it("rejects invalid transitions", () => expect(() => transitionCase("new", "resolved", "2026-08-18T00:00:00.000Z")).toThrow("Invalid case status transition"));
});
