import { describe, expect, it } from "vitest";
import { anonymousDraftScope } from "../src/convex-report-store.js";

describe("durable anonymous reporting", () => {
  it("uses one opaque scope only for the same sender, channel, and direct-message conversation", () => {
    const input = { channel: "telegram" as const, senderId: "provider-user-7", conversationId: "private-chat-42" };
    const scope = anonymousDraftScope("test-secret", input);

    expect(scope).toBe(anonymousDraftScope("test-secret", input));
    expect(scope).not.toContain(input.senderId);
    expect(scope).not.toBe(anonymousDraftScope("test-secret", { ...input, channel: "whatsapp" }));
    expect(scope).not.toBe(anonymousDraftScope("test-secret", { ...input, conversationId: "private-chat-99" }));
    expect(scope).not.toBe(anonymousDraftScope("test-secret", { ...input, senderId: "provider-user-8" }));
  });
});
