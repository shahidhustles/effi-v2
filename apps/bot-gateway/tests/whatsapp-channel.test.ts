import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileChatState, FileInboundMessageStore, FileMessageDedupe, ReportAuthenticationService, SharedReportIngress, SimulatedReportStore, isWhatsAppStatusRequest, normalizeWhatsAppMessage, normalizeWhatsAppMessageWithMedia, whatsappInputForAgent, type WhatsAppChatMessage } from "../src/index.js";

describe("WhatsApp Chat SDK normalization", () => {
  const chatMessage = (overrides: Partial<WhatsAppChatMessage> = {}): WhatsAppChatMessage => ({
    id: "wamid.base",
    threadId: "whatsapp:15551234567",
    text: "",
    author: { userId: "15551234567@s.whatsapp.net", userName: "citizen", fullName: "Citizen", isBot: false, isMe: false },
    metadata: { dateSent: new Date("2026-08-18T12:00:00.000Z"), edited: false },
    attachments: [],
    raw: {},
    ...overrides,
  });

  it("copies image media before exposing the shared inbound contract", async () => {
    const copied: string[] = [];
    const message = chatMessage({
      id: "wamid.image-1",
      text: "A pothole is blocking the road.",
      attachments: [{ type: "image", mimeType: "image/jpeg", fetchData: async () => Buffer.from("staged-photo") }],
      raw: { message: { liveLocationMessage: { degreesLatitude: 19.076, degreesLongitude: 72.8777 } } },
    });
    const normalized = await normalizeWhatsAppMessageWithMedia(message, {
      mediaStorage: {
        async copy(input) {
          copied.push(`${input.messageId}:${input.attachmentId}:${input.data.toString()}`);
          return { storageKey: "effi/whatsapp/wamid.image-1/image-0.jpg" };
        },
      },
    });
    const inbound = normalized.inbound;
    const agentInput = whatsappInputForAgent(message, inbound, normalized.copiedMedia);

    expect(copied).toEqual(["wamid.image-1:image-0:staged-photo"]);
    expect(normalized.copiedMedia[0]?.data.toString()).toBe("staged-photo");
    expect(agentInput).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "file", data: Buffer.from("staged-photo"), mediaType: "image/jpeg" }),
    ]));
    expect(inbound).toMatchObject({
      id: "wamid.image-1",
      channel: "whatsapp",
      conversationId: "whatsapp:15551234567",
      senderId: "15551234567@s.whatsapp.net",
      text: "A pothole is blocking the road.",
      attachments: [expect.not.objectContaining({ quality: expect.anything() })],
      location: { source: "current_gps", latitude: 19.076, longitude: 72.8777 },
    });
    expect(inbound.attachments).toEqual([expect.objectContaining({
      id: "image-0",
      mediaType: "image/jpeg",
      storageKey: "effi/whatsapp/wamid.image-1/image-0.jpg",
    })]);
  });

  it("accepts a manually selected pin without requiring a WhatsApp action", async () => {
    const inbound = await normalizeWhatsAppMessage(chatMessage({
      id: "wamid.pin-1",
      text: "The streetlight is broken.",
      raw: { message: { locationMessage: { degreesLatitude: 28.6139, degreesLongitude: 77.209 } } },
    }));

    expect(inbound.location).toEqual({ source: "selected_pin", latitude: 28.6139, longitude: 77.209 });
    expect(JSON.stringify(whatsappInputForAgent(chatMessage({ id: "wamid.pin-1", text: "The streetlight is broken.", raw: { message: { locationMessage: { degreesLatitude: 28.6139, degreesLongitude: 77.209 } } } }), inbound))).toContain("latitude 28.6139, longitude 77.209");
  });

  it("recognizes Baileys' live flag on a location message as current GPS", async () => {
    const inbound = await normalizeWhatsAppMessage(chatMessage({
      id: "wamid.live-location-1",
      raw: { message: { locationMessage: { isLive: true, degreesLatitude: 19.076, degreesLongitude: 72.8777 } } },
    }));

    expect(inbound.location).toEqual({ source: "current_gps", latitude: 19.076, longitude: 72.8777 });
  });

  it("keeps report status queries outside the agent path", () => {
    expect(isWhatsAppStatusRequest("What is the status of my case?")).toBe(true);
    expect(isWhatsAppStatusRequest("How is my complaint coming along?")).toBe(true);
    expect(isWhatsAppStatusRequest("Has my complaint been resolved?")).toBe(true);
    expect(isWhatsAppStatusRequest("Is my report fixed yet?")).toBe(true);
    expect(isWhatsAppStatusRequest("Any news on my issue?")).toBe(true);
    expect(isWhatsAppStatusRequest("What happened with my report?")).toBe(true);
    expect(isWhatsAppStatusRequest("Is my case being handled?")).toBe(true);
    expect(isWhatsAppStatusRequest("मेरी शिकायत का स्टेटस क्या है?")).toBe(true);
    expect(isWhatsAppStatusRequest("How do I report a pothole?")).toBe(false);
    expect(isWhatsAppStatusRequest("Can I submit a complaint?")).toBe(false);
    expect(isWhatsAppStatusRequest("A pothole blocks the road.")).toBe(false);
  });

  it("keeps provider message IDs deduplicated across restarts and releases failed claims", async () => {
    const directory = await mkdtemp(join(tmpdir(), "effi-whatsapp-dedupe-"));
    const filePath = join(directory, "message-ids.json");
    try {
      expect(await new FileMessageDedupe(filePath).claim("wamid.duplicate-1")).toBe(true);
      expect(await new FileMessageDedupe(filePath).claim("wamid.duplicate-1")).toBe(false);
      await new FileMessageDedupe(filePath).release("wamid.duplicate-1");
      expect(await new FileMessageDedupe(filePath).claim("wamid.duplicate-1")).toBe(true);
      await new FileMessageDedupe(filePath).complete("wamid.duplicate-1");
      expect(await new FileMessageDedupe(filePath).claim("wamid.duplicate-1")).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("persists Chat SDK subscriptions and cached state across restarts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "effi-whatsapp-state-"));
    const filePath = join(directory, "chat-state.json");
    try {
      const first = new FileChatState(filePath);
      await first.connect();
      await first.subscribe("whatsapp:15551234567");
      await first.set("draft", { issue: "pothole" });
      await first.disconnect();

      const second = new FileChatState(filePath);
      expect(await second.isSubscribed("whatsapp:15551234567")).toBe(true);
      expect(await second.get("draft")).toEqual({ issue: "pothole" });
      await second.disconnect();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed coordinates instead of inventing a location", async () => {
    const inbound = await normalizeWhatsAppMessage(chatMessage({
      id: "wamid.invalid-location",
      raw: { message: { locationMessage: { degreesLatitude: 91, degreesLongitude: 77.209 } } },
    }));

    expect(inbound.location).toBeUndefined();
  });

  it("persists normalized inbound messages idempotently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "effi-whatsapp-inbound-"));
    const filePath = join(directory, "inbound-messages.json");
    const message = await normalizeWhatsAppMessage(chatMessage({ id: "wamid.persisted", text: "A pothole blocks the road." }));
    try {
      const first = new FileInboundMessageStore(filePath);
      await first.persist(message);
      await first.persist(message);

      const second = new FileInboundMessageStore(filePath);
      expect(await second.messages()).toEqual([message]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses the shared pending, authentication, report-ID, and acknowledgement path", async () => {
    const acknowledgements: string[] = [];
    const store = new SimulatedReportStore(
      () => "2026-08-18T12:00:00.000Z",
      { authenticationBaseUrl: "https://auth.example.test/effi", tokenFactory: () => "whatsapp-token" },
    );
    const ingress = new SharedReportIngress(store);
    const inbound = await normalizeWhatsAppMessageWithMedia(chatMessage({
      id: "wamid.registration-1",
      text: "A pothole blocks the road.",
      attachments: [{ type: "image", mimeType: "image/jpeg", data: Buffer.from("photo") }],
      raw: { message: { locationMessage: { degreesLatitude: 19.076, degreesLongitude: 72.8777 } } },
    }), {
      mediaStorage: { async copy() { return { storageKey: "effi/whatsapp/registration-1/image-0.jpg" }; } },
    });
    const accepted = ingress.accept(inbound.inbound);
    expect(accepted).toBeDefined();
    if (!accepted) throw new Error("Expected WhatsApp ingress to be persisted.");

    store.markAttachmentInspected("whatsapp", accepted.inbound.conversationId, "image-0");
    store.recordAttachmentQuality("whatsapp", accepted.inbound.conversationId, "image-0", "satisfactory");
    accepted.conversation.phase = "awaiting_confirmation";
    const pending = store.prepareSubmission({
      channel: "whatsapp",
      conversationId: accepted.inbound.conversationId,
      issue: "A pothole blocks the road.",
      category: "roads",
      acceptedAttachmentIds: ["image-0"],
      receivedAt: accepted.inbound.receivedAt,
    });

    const authentication = new ReportAuthenticationService("whatsapp", store, async (_conversationId, text) => {
      acknowledgements.push(text);
    });
    const input = {
      authenticationLink: pending.authenticationLink,
      citizenId: "citizen-1",
      conversationId: accepted.inbound.conversationId,
    };
    const first = await authentication.complete(input);
    const repeated = await authentication.complete(input);

    expect(first.report.id).toBe("report_1");
    expect(repeated.report.id).toBe(first.report.id);
    expect(store.reports()).toHaveLength(1);
    expect(acknowledgements).toEqual(["Your report has been registered. Report ID: report_1"]);
  });
});
