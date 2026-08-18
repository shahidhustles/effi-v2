import { describe, expect, it } from "vitest";
import {
  FakeChannelAdapter,
  FakeVisionReportModel,
  SimulatedReportRegistration,
  SimulatedReportStore,
  type InboundMessage,
} from "../src/index.js";

let messageCount = 0;
const storeAt = (time = "2026-08-18T12:01:00.000Z") => new SimulatedReportStore(() => time);
const message = (overrides: Partial<InboundMessage>): InboundMessage => ({
  id: `message_${++messageCount}`,
  channel: "telegram",
  conversationId: "conversation_1",
  senderId: "telegram_citizen_1",
  receivedAt: "2026-08-18T12:00:00.000Z",
  ...overrides,
});

describe("FakeChannelAdapter", () => {
  it("records outbound messages", async () => {
    const adapter = new FakeChannelAdapter();
    await adapter.send({ channel: "telegram", conversationId: "conversation_1", text: "Hello" });
    expect(adapter.sent).toHaveLength(1);
  });

  it("completes one authenticated report through the shared inbound contract", async () => {
    const adapter = new FakeChannelAdapter();
    const store = storeAt();
    const registration = new SimulatedReportRegistration({ adapter, store, model: new FakeVisionReportModel() });

    await adapter.deliver(message({ text: "There is a large pothole outside the library." }));
    await adapter.deliver(message({ attachments: [{ id: "platform_photo_1", kind: "image", mediaType: "image/jpeg", platformUrl: "https://platform.example/photo.jpg", quality: "satisfactory" }] }));
    await adapter.deliver(message({ location: { source: "current_gps", latitude: 19.076, longitude: 72.8777 } }));

    expect(adapter.sent.at(-1)?.text).toContain("Review your report");

    await adapter.deliver(message({ text: "The issue is a pothole by the library entrance." }));
    expect(adapter.sent.at(-1)?.text).toContain("Review your report");

    await adapter.deliver(message({ text: "confirm" }));
    const authenticationLink = adapter.sent.at(-1)?.authenticationLink;
    expect(authenticationLink).toMatch(/^simulated-auth:\/\//);

    const firstResult = await registration.completeAuthentication({ authenticationLink: authenticationLink!, citizenId: "citizen_42" });
    const repeatedResult = await registration.completeAuthentication({ authenticationLink: authenticationLink!, citizenId: "citizen_42" });

    expect(firstResult.report.id).toEqual(repeatedResult.report.id);
    expect(adapter.sent.at(-1)?.text).toContain(firstResult.report.id);
    expect(store.reports()).toHaveLength(1);
    expect(adapter.sent.filter((outbound) => outbound.text.includes("Report ID:"))).toHaveLength(1);
    await expect(registration.completeAuthentication({ authenticationLink: authenticationLink!, citizenId: "citizen_99" })).rejects.toThrow("already been used");

    const persisted = store.report(firstResult.report.id)!;
    expect(persisted.citizenId).toBe("citizen_42");
    expect(persisted.location).toEqual({ source: "current_gps", latitude: 19.076, longitude: 72.8777 });
    expect(persisted.primaryEvidence).toEqual([{ attachmentId: "platform_photo_1", storageKey: expect.stringMatching(/^effi\//) }]);
    expect(persisted.conversation.messages).toHaveLength(5);
    expect(persisted.conversation.messages[1]?.attachments[0]?.storageKey).toMatch(/^effi\//);

    await adapter.deliver(message({ text: "A streetlight is broken near the park." }));
    const resumed = store.activeConversation("telegram", "conversation_1")!;
    expect(resumed.sessionId).not.toBe(persisted.conversation.sessionId);
    expect(resumed.messages.at(-1)?.text).toContain("streetlight");
  });

  it("rejects an expired authentication link using the server clock", async () => {
    const adapter = new FakeChannelAdapter();
    const store = storeAt("2026-08-18T12:06:00.000Z");
    const registration = new SimulatedReportRegistration({ adapter, store, model: new FakeVisionReportModel() });

    await adapter.deliver(message({ text: "A pothole blocks the road." }));
    await adapter.deliver(message({ attachments: [{ id: "photo_3", kind: "image", mediaType: "image/jpeg", platformUrl: "https://platform.example/photo_3.jpg", quality: "satisfactory" }] }));
    await adapter.deliver(message({ location: { source: "current_gps", latitude: 19.076, longitude: 72.8777 } }));
    await adapter.deliver(message({ text: "confirm" }));
    const expiredLink = adapter.sent.at(-1)?.authenticationLink;
    if (!expiredLink) throw new Error("Expected simulated authentication link.");

    await expect(registration.completeAuthentication({ authenticationLink: expiredLink, citizenId: "citizen_42" })).rejects.toThrow("expired");
  });

  it("keeps an insufficient image in the conversation without accepting it as primary evidence", async () => {
    const adapter = new FakeChannelAdapter();
    const store = storeAt();
    new SimulatedReportRegistration({ adapter, store, model: new FakeVisionReportModel() });

    await adapter.deliver(message({ text: "The drain has overflowed." }));
    await adapter.deliver(message({ attachments: [{ id: "blurred_photo", kind: "image", mediaType: "image/jpeg", platformUrl: "https://platform.example/blurred.jpg", quality: "insufficient" }] }));

    expect(adapter.sent.at(-1)?.text).toContain("clearer photo");
    const conversation = store.activeConversation("telegram", "conversation_1")!;
    expect(conversation.messages[1]?.attachments[0]?.storageKey).toMatch(/^effi\//);
    expect(conversation.acceptedEvidence).toEqual([]);
  });

  it("accepts a manually selected pin through the same shared contract", async () => {
    const adapter = new FakeChannelAdapter();
    const store = storeAt();
    new SimulatedReportRegistration({ adapter, store, model: new FakeVisionReportModel() });

    await adapter.deliver(message({ text: "The streetlight is broken." }));
    await adapter.deliver(message({ attachments: [{ id: "photo_2", kind: "image", mediaType: "image/jpeg", platformUrl: "https://platform.example/photo_2.jpg", quality: "satisfactory" }] }));
    await adapter.deliver(message({ location: { source: "selected_pin", latitude: 28.6139, longitude: 77.209 } }));

    expect(adapter.sent.at(-1)?.interpretation?.location).toEqual({ source: "selected_pin", latitude: 28.6139, longitude: 77.209 });

    await adapter.deliver(message({ text: "The photo is wrong." }));
    expect(adapter.sent.at(-1)?.text).toContain("replacement photo");
    expect(store.activeConversation("telegram", "conversation_1")?.issue).toBe("The streetlight is broken.");

    await adapter.deliver(message({ attachments: [{ id: "photo_4", kind: "image", mediaType: "image/jpeg", platformUrl: "https://platform.example/photo_4.jpg", quality: "satisfactory" }] }));
    expect(adapter.sent.at(-1)?.text).toContain("photo_4");
  });
});
