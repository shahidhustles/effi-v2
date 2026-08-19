import { describe, expect, it } from "vitest";
import { pendingSubmissionDelivery } from "../agent/lib/reporting.js";
import { authenticationPendingReply, isAuthenticationPending } from "../src/authentication-pending.js";
import { anonymousDraftScope } from "../src/convex-report-store.js";
import { eraseAnonymousDraftMedia } from "../src/draft-media-erasure.js";
import { MemoryEvidenceStorage } from "../src/evidence-storage.js";
import { draftCancellationReply, isDraftCancellationCommand } from "../src/report-ingress.js";
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

  it("treats an explicit cancellation or replacement as a gateway command", () => {
    expect(isDraftCancellationCommand({ text: "cancel" })).toBe(true);
    expect(isDraftCancellationCommand({ text: "start over" })).toBe(true);
    expect(isDraftCancellationCommand({ text: "new report" })).toBe(true);
    expect(isDraftCancellationCommand({ text: "there is a new pothole" })).toBe(false);
    expect(draftCancellationReply).toContain("cancelled");
  });

  it("starts an isolated local draft after cancellation", () => {
    const store = new SimulatedReportStore();
    const originalInbound = {
      id: "telegram:old",
      channel: "telegram",
      conversationId: "chat-1",
      senderId: "citizen-1",
      text: "A pothole blocks the road.",
      receivedAt: "2026-08-19T08:00:00.000Z",
    } as const;
    const original = store.startConversation(originalInbound);
    store.persistInbound(original, originalInbound);
    original.issue = "A pothole blocks the road.";

    expect(store.cancelConversation("telegram", "chat-1")).toBe(true);
    const replacement = store.startConversation({
      id: "telegram:new",
      channel: "telegram",
      conversationId: "chat-1",
      senderId: "citizen-1",
      text: "Broken streetlight.",
      receivedAt: "2026-08-19T08:01:00.000Z",
    });

    expect(original.phase).toBe("cancelled");
    expect(replacement.sessionId).not.toBe(original.sessionId);
    expect(replacement.issue).toBeUndefined();
    expect(replacement.messages).toEqual([]);
  });

  it("erases controlled Telegram and WhatsApp media without accepting foreign keys", async () => {
    const telegram = new MemoryEvidenceStorage();
    await telegram.copy({ storageKey: "effi/telegram/chat/message/photo", bytes: new Uint8Array([1]), mediaType: "image/jpeg", sourceReference: "telegram:file" });
    const erasedWhatsApp: string[] = [];

    await eraseAnonymousDraftMedia([
      "effi/telegram/chat/message/photo",
      "effi/whatsapp/message-photo.jpeg",
      "effi/telegram/chat/message/photo",
    ], {
      telegram,
      whatsapp: { async remove(storageKey) { erasedWhatsApp.push(storageKey); } },
    });

    await expect(telegram.read("effi/telegram/chat/message/photo")).rejects.toThrow("not found");
    expect(erasedWhatsApp).toEqual(["effi/whatsapp/message-photo.jpeg"]);
    await expect(eraseAnonymousDraftMedia(["external/object"], { telegram, whatsapp: { async remove() {} } })).rejects.toThrow("not controlled");
  });
});
