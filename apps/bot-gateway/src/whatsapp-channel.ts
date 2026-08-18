import { createMemoryState } from "@chat-adapter/state-memory";
import type { Attachment, Message, StateAdapter, Thread } from "chat";
import { normalizeMessageContent, useMultiFileAuthState } from "baileys";
import { createBaileysAdapter, type BaileysAdapter } from "chat-adapter-baileys";
import { chatSdkChannel, messageToUserContent } from "eve/channels/chat-sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ExactCoordinates, InboundAttachment, InboundMessage } from "./simulated-report-registration.js";

type AgentUserContent = Exclude<ReturnType<typeof messageToUserContent>, string>;

export type WhatsAppChatMessage = Pick<Message, "id" | "threadId" | "text" | "author" | "metadata" | "attachments" | "raw">;

export type MediaStorageCopy = {
  messageId: string;
  attachmentId: string;
  mediaType: string;
  data: Buffer;
};

export interface EffiMediaStorage {
  copy(input: MediaStorageCopy): Promise<{ storageKey: string }>;
}

const safePathSegment = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";
const mediaExtension = (mediaType: string): string => safePathSegment(mediaType.split("/")[1] ?? "bin");

/**
 * Local staged storage for WhatsApp media. The directory should point at the
 * same durable, access-controlled volume used by the always-on bot service.
 */
export class FileMediaStorage implements EffiMediaStorage {
  constructor(private readonly rootDirectory: string) {}

  async copy(input: MediaStorageCopy): Promise<{ storageKey: string }> {
    const relativePath = join(
      "whatsapp",
      `${safePathSegment(input.messageId)}-${safePathSegment(input.attachmentId)}.${mediaExtension(input.mediaType)}`,
    );
    const absolutePath = join(this.rootDirectory, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.data);
    return { storageKey: `effi/${relativePath.split("\\").join("/")}` };
  }
}

export type WhatsAppLocationSource = ExactCoordinates["source"] | ((message: WhatsAppChatMessage) => ExactCoordinates["source"]);

export type NormalizeWhatsAppMessageOptions = {
  locationSource?: WhatsAppLocationSource;
  mediaStorage?: EffiMediaStorage;
};

export type CopiedWhatsAppMedia = {
  attachmentId: string;
  mediaType: string;
  data: Buffer;
};

export type WhatsAppNormalization = {
  inbound: InboundMessage;
  copiedMedia: readonly CopiedWhatsAppMedia[];
};

type WhatsAppRawMessage = { message?: Parameters<typeof normalizeMessageContent>[0] };

const isFiniteCoordinate = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

const locationFrom = (message: WhatsAppChatMessage, source: WhatsAppLocationSource | undefined): ExactCoordinates | undefined => {
  const raw = message.raw as WhatsAppRawMessage;
  const content = normalizeMessageContent(raw.message);
  const liveLocation = content?.liveLocationMessage;
  const locationMessage = content?.locationMessage ?? liveLocation;
  if (!locationMessage || !isFiniteCoordinate(locationMessage.degreesLatitude) || !isFiniteCoordinate(locationMessage.degreesLongitude)) return undefined;

  const locationSource = typeof source === "function"
    ? source(message)
    : source ?? (liveLocation ? "current_gps" : "selected_pin");
  return { source: locationSource, latitude: locationMessage.degreesLatitude, longitude: locationMessage.degreesLongitude };
};

const attachmentData = async (attachment: Attachment): Promise<Buffer> => {
  if (Buffer.isBuffer(attachment.data)) return attachment.data;
  if (attachment.data instanceof Blob) return Buffer.from(await attachment.data.arrayBuffer());
  if (attachment.fetchData) return attachment.fetchData();
  throw new Error("WhatsApp image media could not be acquired.");
};

const copyImageAttachment = async (
  message: WhatsAppChatMessage,
  attachment: Attachment,
  index: number,
  mediaStorage: EffiMediaStorage,
): Promise<{ attachment: InboundAttachment; media: CopiedWhatsAppMedia }> => {
  const attachmentId = `image-${index}`;
  const data = await attachmentData(attachment);
  const mediaType = attachment.mimeType ?? "image/jpeg";
  const copied = await mediaStorage.copy({ messageId: message.id, attachmentId, mediaType, data });
  return {
    attachment: {
      id: attachmentId,
      kind: "image",
      mediaType,
      platformUrl: attachment.url ?? `whatsapp://media/${message.id}/${index}`,
      quality: "satisfactory",
      storageKey: copied.storageKey,
    },
    media: { attachmentId, mediaType, data },
  };
};

/** Normalize Chat SDK's Baileys message and acquire its media before model processing. */
export const normalizeWhatsAppMessageWithMedia = async (
  message: WhatsAppChatMessage,
  options: NormalizeWhatsAppMessageOptions = {},
): Promise<WhatsAppNormalization> => {
  const imageAttachments = message.attachments.filter((attachment) => attachment.type === "image");
  if (imageAttachments.length > 0 && !options.mediaStorage) throw new Error("WhatsApp media storage is required before model processing.");

  const mediaStorage = options.mediaStorage;
  const copied = mediaStorage
    ? await Promise.all(imageAttachments.map((attachment, index) => copyImageAttachment(message, attachment, index, mediaStorage)))
    : [];
  const attachments = copied.map(({ attachment }) => attachment);
  const text = message.text.trim();
  const location = locationFrom(message, options.locationSource);
  return {
    inbound: {
      id: message.id,
      channel: "whatsapp",
      conversationId: message.threadId,
      senderId: message.author.userId,
      ...(text ? { text } : {}),
      attachments,
      ...(location ? { location } : {}),
      receivedAt: message.metadata.dateSent.toISOString(),
    },
    copiedMedia: copied.map(({ media }) => media),
  };
};

export const normalizeWhatsAppMessage = async (
  message: WhatsAppChatMessage,
  options: NormalizeWhatsAppMessageOptions = {},
): Promise<InboundMessage> => (await normalizeWhatsAppMessageWithMedia(message, options)).inbound;

const locationForAgent = (location: ExactCoordinates | undefined): string => location
  ? `\nExact WhatsApp location shared by the citizen (${location.source}): latitude ${location.latitude}, longitude ${location.longitude}. Treat these coordinates as the reported location; do not infer a location from media.`
  : "";

/** Preserve Chat SDK media content while adding the location data Chat SDK does not model. */
export const whatsappInputForAgent = (
  message: WhatsAppChatMessage,
  inbound: InboundMessage,
  copiedMedia: readonly CopiedWhatsAppMedia[] = [],
): string | AgentUserContent => {
  if (copiedMedia.length === 0) {
    const input = messageToUserContent(message);
    const location = locationForAgent(inbound.location);
    if (!location) return input;
    if (typeof input === "string") return `${input}${location}`;
    return [...input, { type: "text", text: location }];
  }

  const parts: AgentUserContent = [];
  if (message.text.trim()) parts.push({ type: "text", text: message.text.trim() });
  for (const media of copiedMedia) {
    parts.push({ type: "file", data: media.data, mediaType: media.mediaType, filename: media.attachmentId });
  }
  const location = locationForAgent(inbound.location);
  if (location) parts.push({ type: "text", text: location });
  return parts;
};

export type WhatsAppChannelOptions = {
  authDirectory: string;
  mediaStorage: EffiMediaStorage;
  connect?: boolean;
  state?: StateAdapter;
  userName?: string;
  phoneNumber?: string;
  onQR?: (qr: string) => void | Promise<void>;
  onPairingCode?: (code: string) => void;
  locationSource?: WhatsAppLocationSource;
  onInbound?: (message: InboundMessage) => void | Promise<void>;
};

export type WhatsAppChannelRuntime = {
  bot: ReturnType<typeof chatSdkChannel>["bot"];
  channel: ReturnType<typeof chatSdkChannel>["channel"];
  send: ReturnType<typeof chatSdkChannel>["send"];
  whatsapp: BaileysAdapter;
  disconnect: () => Promise<void>;
};

/**
 * Build and connect the staged WhatsApp transport. The returned channel uses
 * the root Eve agent; it does not create a WhatsApp-specific reporting agent.
 */
export const createWhatsAppChannel = async (options: WhatsAppChannelOptions): Promise<WhatsAppChannelRuntime> => {
  await mkdir(options.authDirectory, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(options.authDirectory);
  const whatsapp = createBaileysAdapter({
    adapterName: "whatsapp",
    auth: { state: authState, saveCreds },
    userName: options.userName ?? "Effi",
    ...(options.phoneNumber ? { phoneNumber: options.phoneNumber } : {}),
    ...(options.onQR ? { onQR: options.onQR } : {}),
    ...(options.onPairingCode ? { onPairingCode: options.onPairingCode } : {}),
  });
  const runtime = chatSdkChannel({
    userName: options.userName ?? "Effi",
    adapters: { whatsapp },
    state: options.state ?? createMemoryState(),
    streaming: false,
    concurrency: "concurrent",
    dedupeTtlMs: 24 * 60 * 60 * 1_000,
  });

  const handleMessage = async (thread: Thread, message: Message): Promise<void> => {
    if (message.author.isMe) return;
    const normalized = await normalizeWhatsAppMessageWithMedia(message, {
      mediaStorage: options.mediaStorage,
      ...(options.locationSource ? { locationSource: options.locationSource } : {}),
    });
    await options.onInbound?.(normalized.inbound);
    await thread.subscribe();
    await runtime.send(whatsappInputForAgent(message, normalized.inbound, normalized.copiedMedia), { thread });
  };

  runtime.bot.onDirectMessage(handleMessage);
  runtime.bot.onNewMention(handleMessage);
  runtime.bot.onSubscribedMessage(handleMessage);
  await runtime.bot.initialize();
  if (options.connect ?? process.env.WHATSAPP_CONNECT !== "0") await whatsapp.connect();

  return { ...runtime, whatsapp, disconnect: () => whatsapp.disconnect() };
};
