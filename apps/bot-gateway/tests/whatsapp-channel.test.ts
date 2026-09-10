import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WAMessage, WASocket } from "baileys";
import { describe, expect, it } from "vitest";
import {
  FileMessageDedupe,
  isWhatsAppStatusRequest,
  normalizeWhatsAppMessage,
  parseWhatsAppAllowedNumbers,
  resolveAllowedWhatsAppSender,
  whatsappUserContent,
  type EffiMediaStorage,
} from "../src/index.js";

const allowedNumbers = parseWhatsAppAllowedNumbers("+91 98765-43210");
const sender = {
  jid: "919876543210@s.whatsapp.net",
  phoneJid: "919876543210@s.whatsapp.net",
  phoneNumber: "919876543210",
};
const socket = {} as WASocket;
const message = (id: string, content: NonNullable<WAMessage["message"]>): WAMessage => ({
  key: { id, remoteJid: sender.jid, fromMe: false },
  message: content,
  messageTimestamp: 1_787_057_600,
});

describe("direct WhatsApp channel", () => {
  it("allows only the configured phone number", async () => {
    const lookup = async (): Promise<string | null> => null;

    await expect(resolveAllowedWhatsAppSender({ jid: sender.jid, allowedNumbers, getPhoneJidForLid: lookup }))
      .resolves.toEqual(sender);
    await expect(resolveAllowedWhatsAppSender({
      jid: "919999999999@s.whatsapp.net",
      allowedNumbers,
      getPhoneJidForLid: lookup,
    })).resolves.toBeUndefined();
    await expect(resolveAllowedWhatsAppSender({
      jid: "120363000000000000@g.us",
      allowedNumbers,
      getPhoneJidForLid: lookup,
    })).resolves.toBeUndefined();
  });

  it("accepts an allowed sender represented by a mapped LID", async () => {
    const identity = await resolveAllowedWhatsAppSender({
      jid: "123456789012345@lid",
      allowedNumbers,
      getPhoneJidForLid: async () => sender.phoneJid,
    });

    expect(identity).toEqual({ ...sender, jid: "123456789012345@lid" });
  });

  it("normalizes a text message into the shared report contract", async () => {
    const normalized = await normalizeWhatsAppMessage({
      message: message("wamid.text-1", { conversation: "  A pothole blocks the road.  " }),
      socket,
      sender,
      mediaStorage: { async copy() { throw new Error("text messages have no media"); } },
    });

    expect(normalized?.inbound).toMatchObject({
      id: "whatsapp:wamid.text-1",
      providerEventId: "wamid.text-1",
      channel: "whatsapp",
      conversationId: sender.jid,
      senderId: sender.phoneJid,
      text: "A pothole blocks the road.",
    });
    expect(normalized && whatsappUserContent(normalized, normalized.inbound)).toEqual([
      { type: "text", text: "A pothole blocks the road." },
    ]);
  });

  it("copies image bytes before exposing them to Eve", async () => {
    const copies: string[] = [];
    const mediaStorage: EffiMediaStorage = {
      async copy(input) {
        copies.push(`${input.attachmentId}:${input.data.toString()}`);
        return { storageKey: `effi/whatsapp/${input.attachmentId}.jpg` };
      },
    };
    const normalized = await normalizeWhatsAppMessage({
      message: message("wamid.image-1", { imageMessage: { mimetype: "image/jpeg", caption: "Evidence" } }),
      socket,
      sender,
      mediaStorage,
      downloadMedia: async () => Buffer.from("photo"),
    });

    expect(copies).toEqual(["wamid_image-1-image-0:photo"]);
    expect(normalized?.inbound.attachments).toEqual([
      expect.objectContaining({
        id: "wamid_image-1-image-0",
        kind: "image",
        storageKey: "effi/whatsapp/wamid_image-1-image-0.jpg",
      }),
    ]);
  });

  it("retains an exact WhatsApp pin without inventing coordinates", async () => {
    const normalized = await normalizeWhatsAppMessage({
      message: message("wamid.location-1", {
        locationMessage: { degreesLatitude: 19.076, degreesLongitude: 72.8777 },
      }),
      socket,
      sender,
      mediaStorage: { async copy() { throw new Error("location messages have no media"); } },
    });
    const invalid = await normalizeWhatsAppMessage({
      message: message("wamid.location-2", {
        locationMessage: { degreesLatitude: 91, degreesLongitude: 72.8777 },
      }),
      socket,
      sender,
      mediaStorage: { async copy() { throw new Error("location messages have no media"); } },
    });

    expect(normalized?.inbound.location).toEqual({
      source: "selected_pin",
      latitude: 19.076,
      longitude: 72.8777,
    });
    expect(invalid).toBeUndefined();
  });

  it("deduplicates provider IDs across restarts and releases failed claims", async () => {
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

  it("keeps case-status requests outside the registration agent", () => {
    expect(isWhatsAppStatusRequest("What is the status of my complaint?")).toBe(true);
    expect(isWhatsAppStatusRequest("How do I report a pothole?")).toBe(false);
  });
});
