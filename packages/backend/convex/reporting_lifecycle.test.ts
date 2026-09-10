import { describe, expect, it } from "vitest";
import { anonymousDraftLifetimeMs, isAnonymousDraftExpired } from "./reporting_lifecycle";

describe("anonymous report lifecycle", () => {
  it("expires an abandoned draft after 24 hours", () => {
    const lastActivityAt = Date.parse("2026-09-10T12:00:00.000Z");

    expect(anonymousDraftLifetimeMs).toBe(24 * 60 * 60 * 1_000);
    expect(isAnonymousDraftExpired(lastActivityAt, lastActivityAt + anonymousDraftLifetimeMs - 1)).toBe(false);
    expect(isAnonymousDraftExpired(lastActivityAt, lastActivityAt + anonymousDraftLifetimeMs)).toBe(true);
  });
});
