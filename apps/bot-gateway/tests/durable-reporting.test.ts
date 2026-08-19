import { describe, expect, it } from "vitest";
import { pendingSubmissionDelivery } from "../agent/lib/reporting.js";
import { authenticationPendingReply, isAuthenticationPending } from "../src/authentication-pending.js";
import { anonymousDraftScope } from "../src/convex-report-store.js";
import { SimulatedReportStore } from "../src/simulated-report-registration.js";

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

  it("treats the claim link as opaque when preparing the client delivery", () => {
    const claimLink = "https://auth.effi.test/claim/opaque-single-use-secret";

    expect(pendingSubmissionDelivery(claimLink)).toEqual({
      recipientMessage: `Your report is ready. Complete registration here: ${claimLink}`,
    });
    expect(pendingSubmissionDelivery(claimLink).recipientMessage).not.toContain("pendingSubmissionId");
    expect(pendingSubmissionDelivery(claimLink).recipientMessage).not.toContain("coordinates");
    expect(pendingSubmissionDelivery(claimLink).recipientMessage).not.toContain("evidence");
    expect(authenticationPendingReply).toBe("Your report is ready. Complete the authentication link to register it.");
  });

  it("recognizes a conversation locked for authentication without exposing its pending submission", () => {
    const store = new SimulatedReportStore();
    const conversation = store.startConversation({
      id: "telegram:1",
      channel: "telegram" as const,
      conversationId: "chat-1",
      senderId: "citizen-1",
      text: "A pothole blocks the road.",
      receivedAt: "2026-08-19T08:00:00.000Z",
    });
    conversation.phase = "authentication_pending";

    expect(isAuthenticationPending(store, "telegram", conversation.conversationId)).toBe(true);
    expect(isAuthenticationPending(store, "telegram", "another-chat")).toBe(false);
  });
});
