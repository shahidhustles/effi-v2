import type { ExactCoordinates, InboundAttachment, InboundMessage, PhotoQuality } from "./simulated-report-registration.js";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type RawObject = Record<string, unknown>;
const asRecord = (value: unknown): RawObject | undefined => (
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as RawObject : undefined
);
const photoQualities = new Set<PhotoQuality>(["satisfactory", "insufficient", "unrelated", "unusable", "uncertain", "undecodable"]);

const parseAttachment = (value: unknown): InboundAttachment | undefined => {
  const attachment = asRecord(value);
  const quality = attachment?.quality;
  if (
    typeof attachment?.id !== "string"
    || attachment.kind !== "image"
    || typeof attachment.mediaType !== "string"
    || typeof attachment.platformUrl !== "string"
    || quality !== undefined && (typeof quality !== "string" || !photoQualities.has(quality as PhotoQuality))
  ) return undefined;
  return {
    id: attachment.id,
    kind: "image",
    mediaType: attachment.mediaType,
    platformUrl: attachment.platformUrl,
    ...(quality === undefined ? {} : { quality: quality as PhotoQuality }),
    ...(typeof attachment.storageKey === "string" ? { storageKey: attachment.storageKey } : {}),
  };
};

const parseLocation = (value: unknown): ExactCoordinates | undefined => {
  const location = asRecord(value);
  const source = location?.source;
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  if (
    (source !== "current_gps" && source !== "selected_pin")
    || typeof latitude !== "number"
    || !Number.isFinite(latitude)
    || latitude < -90
    || latitude > 90
    || typeof longitude !== "number"
    || !Number.isFinite(longitude)
    || longitude < -180
    || longitude > 180
  ) return undefined;
  return { source, latitude, longitude };
};

const parseInboundMessage = (value: unknown): InboundMessage | undefined => {
  const message = asRecord(value);
  const attachments = Array.isArray(message?.attachments)
    ? message.attachments.flatMap((attachment) => {
      const parsed = parseAttachment(attachment);
      return parsed ? [parsed] : [];
    })
    : [];
  if (
    typeof message?.id !== "string"
    || message.channel !== "telegram" && message.channel !== "whatsapp"
    || typeof message.conversationId !== "string"
    || typeof message.senderId !== "string"
    || typeof message.receivedAt !== "string"
  ) return undefined;
  const parsedLocation = message.location === undefined ? undefined : parseLocation(message.location);
  return {
    id: message.id,
    channel: message.channel,
    conversationId: message.conversationId,
    senderId: message.senderId,
    ...(typeof message.text === "string" ? { text: message.text } : {}),
    attachments,
    ...(parsedLocation ? { location: parsedLocation } : {}),
    receivedAt: message.receivedAt,
  };
};

/** Durable staged ingress record that can be replaced by the Convex ingress. */
export class FileInboundMessageStore {
  #messages: InboundMessage[] = [];
  #messageKeys = new Set<string>();
  #pendingKeys = new Set<string>();
  #loaded?: Promise<void>;
  #writeQueue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async persist(message: InboundMessage): Promise<void> {
    await this.#load();
    const key = `${message.channel}:${message.id}`;
    if (this.#messageKeys.has(key) || this.#pendingKeys.has(key)) return;
    this.#pendingKeys.add(key);
    this.#messages.push(message);
    try {
      await this.#persist();
      this.#messageKeys.add(key);
    } catch (error) {
      this.#messageKeys.delete(key);
      const index = this.#messages.findIndex((candidate) => `${candidate.channel}:${candidate.id}` === key);
      if (index >= 0) this.#messages.splice(index, 1);
      throw error;
    } finally {
      this.#pendingKeys.delete(key);
    }
  }

  async messages(): Promise<readonly InboundMessage[]> {
    await this.#load();
    return this.#messages.map((message) => ({
      ...message,
      ...(message.attachments ? { attachments: message.attachments.map((attachment) => ({ ...attachment })) } : {}),
      ...(message.location ? { location: { ...message.location } } : {}),
    }));
  }

  async #load(): Promise<void> {
    this.#loaded ??= (async () => {
      try {
        const stored: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
        const entries = Array.isArray(stored) ? stored : asRecord(stored)?.messages;
        if (!Array.isArray(entries)) return;
        for (const entry of entries) {
          const message = parseInboundMessage(entry);
          if (!message) continue;
          const key = `${message.channel}:${message.id}`;
          if (this.#messageKeys.has(key)) continue;
          this.#messageKeys.add(key);
          this.#messages.push(message);
        }
      } catch (error) {
        const code = error instanceof Error && "code" in error ? error.code : undefined;
        if (code !== "ENOENT") throw error;
      }
    })();
    await this.#loaded;
  }

  #persist(): Promise<void> {
    const serialized = JSON.stringify({ messages: this.#messages });
    const temporaryPath = `${this.filePath}.tmp`;
    this.#writeQueue = this.#writeQueue.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, serialized, "utf8");
      await rename(temporaryPath, this.filePath);
    });
    return this.#writeQueue;
  }
}
