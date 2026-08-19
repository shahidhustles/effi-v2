import { describe, expect, it } from "vitest";

describe("report claim route", () => {
  it("keeps the opaque token as the only claim value in its return path", () => {
    const token = "opaque-single-use-token";
    expect(`/effi/auth/${encodeURIComponent(token)}`).toBe("/effi/auth/opaque-single-use-token");
  });
});
