import { describe, expect, it } from "vitest";
import { normalizeWhatsAppMessage, normalizeWhatsAppMessageWithMedia, whatsappInputForAgent, type WhatsAppChatMessage } from "../src/index.js";

describe("WhatsApp Chat SDK normalization", () => {
  it("copies image media before exposing the shared inbound contract", async () => {
    const copied: string[] = [];
    const message = {
      id: "wamid.image-1",
      threadId: "whatsapp:15551234567",
      text: "A pothole is blocking the road.",
      author: { userId: "15551234567@s.whatsapp.net", userName: "citizen", fullName: "Citizen", isBot: false, isMe: false },
      metadata: { dateSent: new Date("2026-08-18T12:00:00.000Z"), edited: false },
      attachments: [{ type: "image", mimeType: "image/jpeg", fetchData: async () => Buffer.from("staged-photo") }],
      raw: { message: { locationMessage: { degreesLatitude: 19.076, degreesLongitude: 72.8777 } } },
    } satisfies WhatsAppChatMessage;
    const normalized = await normalizeWhatsAppMessageWithMedia(message, {
      locationSource: "current_gps",
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
      location: { source: "current_gps", latitude: 19.076, longitude: 72.8777 },
    });
    expect(inbound.attachments).toEqual([expect.objectContaining({
      id: "image-0",
      mediaType: "image/jpeg",
      storageKey: "effi/whatsapp/wamid.image-1/image-0.jpg",
    })]);
  });

  it("accepts a manually selected pin without requiring a WhatsApp action", async () => {
    const inbound = await normalizeWhatsAppMessage({
      id: "wamid.pin-1",
      threadId: "whatsapp:15551234567",
      text: "The streetlight is broken.",
      author: { userId: "15551234567@s.whatsapp.net", userName: "citizen", fullName: "Citizen", isBot: false, isMe: false },
      metadata: { dateSent: new Date("2026-08-18T12:00:00.000Z"), edited: false },
      attachments: [],
      raw: { message: { locationMessage: { degreesLatitude: 28.6139, degreesLongitude: 77.209 } } },
    } satisfies WhatsAppChatMessage);

    expect(inbound.location).toEqual({ source: "selected_pin", latitude: 28.6139, longitude: 77.209 });
    expect(JSON.stringify(whatsappInputForAgent({
      id: "wamid.pin-1",
      threadId: "whatsapp:15551234567",
      text: "The streetlight is broken.",
      author: { userId: "15551234567@s.whatsapp.net", userName: "citizen", fullName: "Citizen", isBot: false, isMe: false },
      metadata: { dateSent: new Date("2026-08-18T12:00:00.000Z"), edited: false },
      attachments: [],
      raw: { message: { locationMessage: { degreesLatitude: 28.6139, degreesLongitude: 77.209 } } },
    } satisfies WhatsAppChatMessage, inbound))).toContain("latitude 28.6139, longitude 77.209");
  });
});
