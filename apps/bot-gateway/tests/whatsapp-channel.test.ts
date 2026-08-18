import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileMessageDedupe, isWhatsAppStatusRequest, normalizeWhatsAppMessage, normalizeWhatsAppMessageWithMedia, whatsappInputForAgent, type WhatsAppChatMessage } from "../src/index.js";

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
      attachments: [expect.objectContaining({ quality: "pending" })],
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

  it("keeps report status queries outside the agent path", () => {
    expect(isWhatsAppStatusRequest("What is the status of my case?")).toBe(true);
    expect(isWhatsAppStatusRequest("A pothole blocks the road.")).toBe(false);
  });

  it("keeps provider message IDs deduplicated across restarts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "effi-whatsapp-dedupe-"));
    const filePath = join(directory, "message-ids.json");
    try {
      expect(await new FileMessageDedupe(filePath).claim("wamid.duplicate-1")).toBe(true);
      expect(await new FileMessageDedupe(filePath).claim("wamid.duplicate-1")).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
