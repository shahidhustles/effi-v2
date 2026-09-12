import { describe, expect, it } from "vitest";
import { officerSignInUrl } from "./proxy";

describe("officer case route protection", () => {
  it("gives Clerk an absolute sign-in URL", async () => {
    const request = new Request("http://localhost:3000/cases/case-1");

    expect(officerSignInUrl(request)).toBe("http://localhost:3000/");
  });
});
