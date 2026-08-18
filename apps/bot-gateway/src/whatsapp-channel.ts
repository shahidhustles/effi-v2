import type { Attachment, Message, StateAdapter, Thread } from "chat";
import { useMultiFileAuthState } from "baileys";
import { createBaileysAdapter, type BaileysAdapter } from "chat-adapter-baileys";
import { chatSdkChannel, messageToUserContent } from "eve/channels/chat-sdk";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { FileChatState } from "./file-chat-state.js";
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

export interface WhatsAppMessageDedupe {
  claim(messageId: string): Promise<boolean>;
  complete?(messageId: string): Promise<void>;
  release?(messageId: string): Promise<void>;
}

type PersistedDedupe = { completed: string[]; inFlight: Record<string, number> };

/** Durable provider-ID gate for the single always-on WhatsApp process. */
export class FileMessageDedupe implements WhatsAppMessageDedupe {
  #completed = new Set<string>();
  #inFlight = new Map<string, number>();
  #loaded?: Promise<void>;
  #writeQueue = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly maxEntries = 10_000,
    private readonly claimLeaseMs = 5 * 60_000,
  ) {}

  async claim(messageId: string): Promise<boolean> {
    await this.#load();
    if (this.#completed.has(messageId)) return false;
    const claimedAt = this.#inFlight.get(messageId);
    if (claimedAt !== undefined && Date.now() - claimedAt < this.claimLeaseMs) return false;
    this.#inFlight.set(messageId, Date.now());
    try {
      await this.#persist();
    } catch (error) {
      this.#inFlight.delete(messageId);
      throw error;
    }
    return true;
  }

  async complete(messageId: string): Promise<void> {
    await this.#load();
    this.#inFlight.delete(messageId);
    this.#completed.add(messageId);
    while (this.#completed.size > this.maxEntries) {
      const oldest = this.#completed.values().next().value;
      if (oldest === undefined) break;
      this.#completed.delete(oldest);
    }
    await this.#persist();
  }

  async release(messageId: string): Promise<void> {
    await this.#load();
    this.#inFlight.delete(messageId);
    await this.#persist();
  }

  #load(): Promise<void> {
    this.#loaded ??= (async () => {
      try {
        const stored: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
        if (Array.isArray(stored)) {
          for (const messageId of stored) if (typeof messageId === "string") this.#completed.add(messageId);
        } else {
          const persisted = asRecord(stored);
          const completed = persisted?.completed;
          if (Array.isArray(completed)) {
            for (const messageId of completed) if (typeof messageId === "string") this.#completed.add(messageId);
          }
          const inFlight = asRecord(persisted?.inFlight);
          for (const [messageId, claimedAt] of Object.entries(inFlight ?? {})) {
            if (typeof claimedAt === "number" && Number.isFinite(claimedAt)) this.#inFlight.set(messageId, claimedAt);
          }
        }
      } catch (error) {
        const code = error instanceof Error && "code" in error ? error.code : undefined;
        if (code !== "ENOENT") throw error;
      }
    })();
    return this.#loaded;
  }

  #persist(): Promise<void> {
    const persisted: PersistedDedupe = { completed: [...this.#completed], inFlight: Object.fromEntries(this.#inFlight) };
    const serialized = JSON.stringify(persisted);
    const temporaryPath = `${this.filePath}.tmp`;
    this.#writeQueue = this.#writeQueue.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, serialized, "utf8");
      await rename(temporaryPath, this.filePath);
    });
    return this.#writeQueue;
  }
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

  async read(storageKey: string): Promise<Uint8Array> {
    if (!storageKey.startsWith("effi/whatsapp/")) throw new Error("The WhatsApp evidence key is invalid.");
    const root = resolve(this.rootDirectory);
    const absolutePath = resolve(root, storageKey.slice("effi/".length));
    if (!absolutePath.startsWith(`${root}${sep}`)) throw new Error("The WhatsApp evidence key is invalid.");
    return readFile(absolutePath);
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

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

type RawObject = Record<string, unknown>;
const asRecord = (value: unknown): RawObject | undefined => (
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as RawObject : undefined
);

const rawContentFrom = (raw: unknown): RawObject | undefined => {
  let content = asRecord(asRecord(raw)?.message);
  for (const wrapperName of ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV3", "documentWithCaptionMessage"]) {
    const wrapper = asRecord(content?.[wrapperName]);
    if (!wrapper) continue;
    content = asRecord(wrapper.message);
    if (!content) return undefined;
  }
  return content;
};

const coordinatesFrom = (value: unknown): Pick<ExactCoordinates, "latitude" | "longitude"> | undefined => {
  const location = asRecord(value);
  const latitude = location?.degreesLatitude;
  const longitude = location?.degreesLongitude;
  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) return undefined;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined;
  return { latitude, longitude };
};

const locationFrom = (message: WhatsAppChatMessage, source: WhatsAppLocationSource | undefined): ExactCoordinates | undefined => {
  const content = rawContentFrom(message.raw);
  const liveLocation = coordinatesFrom(content?.liveLocationMessage);
  const rawLocationMessage = asRecord(content?.locationMessage);
  const locationMessage = coordinatesFrom(rawLocationMessage);
  const coordinates = locationMessage ?? liveLocation;
  if (!coordinates) return undefined;

  const locationSource = typeof source === "function"
    ? source(message)
    : source ?? (liveLocation || rawLocationMessage?.isLive === true ? "current_gps" : "selected_pin");
  return { source: locationSource, ...coordinates };
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

export const isWhatsAppStatusRequest = (text: string): boolean => {
  const normalized = text.trim().toLocaleLowerCase();
  if (!normalized) return false;
  const statusTerms = /\b(status|progress|tracking|track|update|updates|registered|submitted|accepted|approved|done|completed|resolved|fixed|finished|processed|received|delivered|coming along|going|far along|making progress|taken care of|heard back|action taken|what happened to|where is|did you receive|have you received)\b|स्थिति|स्टेटस|प्रगति|ट्रैक|अपडेट|रजिस्टर|जमा हुआ|कब तक|कहाँ तक/iu;
  const reportTerms = /\b(report|case|complaint|submission|application|request|reference|ticket|issue)\b|रिपोर्ट|शिकायत|आवेदन|मामला|अनुरोध|टिकट/iu;
  const questionTerms = /\b(what|when|where|how|any|is|has|will|can|did)\b|क्या|कब|कहाँ|कैसे|हुआ|है|मिला/iu;
  const historicalReference = /\b(my|our|the|that|this|previous|already|filed|sent|submitted)\b|मेरा|मेरी|हमारा|पहले|जमा/iu.test(normalized);
  const asksQuestion = normalized.includes("?") || questionTerms.test(normalized);
  const explicitStatus = statusTerms.test(normalized) && (reportTerms.test(normalized) || questionTerms.test(normalized));
  const historicalReportQuestion = asksQuestion && historicalReference && reportTerms.test(normalized);
  return explicitStatus || historicalReportQuestion;
};

const statusBoundaryReply = "I can help register a new civic report, but WhatsApp does not provide report or case status. Please describe a new issue to begin.";

/** Preserve Chat SDK media content while adding the location data Chat SDK does not model. */
export const whatsappInputForAgent = (
  message: WhatsAppChatMessage,
  inbound: InboundMessage,
  copiedMedia: readonly CopiedWhatsAppMedia[] = [],
): string | AgentUserContent => {
  const location = locationForAgent(inbound.location);
  if (copiedMedia.length === 0) {
    const input = messageToUserContent(message);
    if (!location) return input;
    if (typeof input === "string") return `${input}${location}`;
    return [...input, { type: "text", text: location }];
  }

  const parts: AgentUserContent = [];
  if (message.text.trim()) parts.push({ type: "text", text: message.text.trim() });
  for (const media of copiedMedia) {
    parts.push({ type: "file", data: media.data, mediaType: media.mediaType, filename: media.attachmentId });
  }
  if (location) parts.push({ type: "text", text: location });
  return parts;
};

export type WhatsAppChannelOptions = {
  authDirectory: string;
  mediaStorage: EffiMediaStorage;
  connect?: boolean;
  messageDedupe?: WhatsAppMessageDedupe;
  state?: StateAdapter;
  userName?: string;
  phoneNumber?: string;
  onQR?: (qr: string) => void | Promise<void>;
  onPairingCode?: (code: string) => void;
  locationSource?: WhatsAppLocationSource;
  onInbound?: (message: InboundMessage) => string | null | void | Promise<string | null | void>;
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
  const messageDedupe = options.messageDedupe ?? new FileMessageDedupe(join(options.authDirectory, "message-ids.json"));
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
    state: options.state ?? new FileChatState(join(options.authDirectory, "chat-state.json")),
    streaming: false,
    concurrency: "concurrent",
    dedupeTtlMs: 24 * 60 * 60 * 1_000,
  });

  const handleMessage = async (thread: Thread, message: Message): Promise<void> => {
    if (message.author.isMe) return;
    let claimed = false;
    try {
      claimed = await messageDedupe.claim(message.id);
      if (!claimed) return;
      const normalized = await normalizeWhatsAppMessageWithMedia(message, {
        mediaStorage: options.mediaStorage,
        ...(options.locationSource ? { locationSource: options.locationSource } : {}),
      });
      const ingressContext = await options.onInbound?.(normalized.inbound);
      if (ingressContext === null) {
        await messageDedupe.complete?.(message.id);
        return;
      }
      if (isWhatsAppStatusRequest(message.text)) {
        await thread.post(statusBoundaryReply);
      } else {
        await thread.subscribe();
        const agentInput = whatsappInputForAgent(message, normalized.inbound, normalized.copiedMedia);
        const inputWithContext = ingressContext
          ? typeof agentInput === "string"
            ? `${agentInput}\n\n${ingressContext}`
            : [...agentInput, { type: "text" as const, text: ingressContext }]
          : agentInput;
        await runtime.send(inputWithContext, {
          thread,
          title: "Effi civic report registration",
          auth: {
            authenticator: "whatsapp-chat-sdk",
            principalType: "user",
            principalId: message.author.userId,
            attributes: { channel: "whatsapp", conversation_id: message.threadId },
          },
        });
      }
      await messageDedupe.complete?.(message.id);
    } catch (error) {
      if (claimed) await messageDedupe.release?.(message.id);
      throw error;
    }
  };

  runtime.bot.onDirectMessage(handleMessage);
  runtime.bot.onNewMention(handleMessage);
  runtime.bot.onSubscribedMessage(handleMessage);
  await runtime.bot.initialize();
  if (options.connect ?? process.env.WHATSAPP_CONNECT !== "0") await whatsapp.connect();

  return { ...runtime, whatsapp, disconnect: () => whatsapp.disconnect() };
};
