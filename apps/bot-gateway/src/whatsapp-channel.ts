import type { Attachment, Message, StateAdapter, Thread } from "chat";
import { useMultiFileAuthState } from "baileys";
import { createBaileysAdapter, type BaileysAdapter } from "chat-adapter-baileys";
import { chatSdkChannel, messageToUserContent } from "eve/channels/chat-sdk";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { FileChatState } from "./file-chat-state.js";
import type { ExactCoordinates, InboundAttachment, InboundMessage } from "./simulated-report-registration.js";
import {
  isReportReviewMessage,
  pendingVoiceMessage,
  synthesizeVoiceOrUndefined,
  transcribeInboundVoice,
  voiceRecoveryText,
  voicePreferences,
  type VoiceProvider,
  type VoiceAudio,
} from "./voice.js";
import { sarvamVoiceProvider } from "./sarvam-voice-provider.js";
import {
  FileMessageDedupe,
  safeStorageSegment,
  type EffiMediaStorage,
  type WhatsAppMessageDedupe,
} from "./whatsapp-persistence.js";

export type AgentUserContent = Exclude<ReturnType<typeof messageToUserContent>, string>;

export type WhatsAppChatMessage = Pick<Message, "id" | "threadId" | "text" | "author" | "metadata" | "attachments" | "raw">;

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

export type CopiedWhatsAppVoice = {
  attachmentId: string;
  mediaType: string;
  data: Buffer;
  fileName?: string;
};

export type WhatsAppNormalization = {
  inbound: InboundMessage;
  copiedMedia: readonly CopiedWhatsAppMedia[];
  copiedVoice?: CopiedWhatsAppVoice;
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
  throw new Error("WhatsApp media could not be acquired.");
};

const copyImageAttachment = async (
  message: WhatsAppChatMessage,
  attachment: Attachment,
  index: number,
  mediaStorage: EffiMediaStorage,
): Promise<{ attachment: InboundAttachment; media: CopiedWhatsAppMedia }> => {
  const attachmentId = `${safeStorageSegment(message.id)}-image-${index}`;
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

const copyAudioAttachment = async (
  message: WhatsAppChatMessage,
  attachment: Attachment,
  index: number,
  mediaStorage: EffiMediaStorage,
): Promise<{ attachment: InboundAttachment; media: CopiedWhatsAppVoice }> => {
  const attachmentId = `${safeStorageSegment(message.id)}-audio-${index}`;
  const data = await attachmentData(attachment);
  const mediaType = attachment.mimeType ?? "audio/ogg";
  const copied = await mediaStorage.copy({ messageId: message.id, attachmentId, mediaType, data });
  return {
    attachment: {
      id: attachmentId,
      kind: "audio",
      mediaType,
      platformUrl: attachment.url ?? `whatsapp://media/${message.id}/${index}`,
      storageKey: copied.storageKey,
    },
    media: {
      attachmentId,
      mediaType,
      data,
      ...(attachment.name ? { fileName: attachment.name } : {}),
    },
  };
};

/** Normalize Chat SDK's Baileys message and acquire its media before model processing. */
export const normalizeWhatsAppMessageWithMedia = async (
  message: WhatsAppChatMessage,
  options: NormalizeWhatsAppMessageOptions = {},
): Promise<WhatsAppNormalization> => {
  const imageAttachments = message.attachments.filter((attachment) => attachment.type === "image");
  const audioAttachments = message.attachments.filter((attachment) => attachment.type === "audio");
  if ((imageAttachments.length > 0 || audioAttachments.length > 0) && !options.mediaStorage) throw new Error("WhatsApp media storage is required before model processing.");

  const mediaStorage = options.mediaStorage;
  const copiedImages = mediaStorage
    ? await Promise.all(imageAttachments.map((attachment, index) => copyImageAttachment(message, attachment, index, mediaStorage)))
    : [];
  const copiedVoices = mediaStorage
    ? await Promise.all(audioAttachments.map((attachment, index) => copyAudioAttachment(message, attachment, index, mediaStorage)))
    : [];
  const attachments = [
    ...copiedImages.map(({ attachment }) => attachment),
    ...copiedVoices.map(({ attachment }) => attachment),
  ];
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
    copiedMedia: copiedImages.map(({ media }) => media),
    ...(copiedVoices[0] ? { copiedVoice: copiedVoices[0].media } : {}),
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
  const inputText = [message.text.trim(), inbound.voiceTranscript?.trim()]
    .filter((text): text is string => Boolean(text))
    .join("\n\n");
  if (copiedMedia.length === 0) {
    if (inputText) return `${inputText}${location}`;
    const input = messageToUserContent(message);
    if (!location) return input;
    if (typeof input === "string") return `${input}${location}`;
    return [...input, { type: "text", text: location }];
  }

  const parts: AgentUserContent = [];
  if (inputText) parts.push({ type: "text", text: inputText });
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
  voiceProvider?: VoiceProvider;
  onInbound?: (message: InboundMessage) => string | null | void | Promise<string | null | void>;
  onVoiceTranscribed?: (message: InboundMessage) => string | null | void | Promise<string | null | void>;
  isAuthenticationPending?: (message: InboundMessage) => boolean;
  onAuthenticationPending?: (thread: Thread, message: InboundMessage) => void | Promise<void>;
  isReportReadyForReview?: (conversationId: string) => boolean;
  dispatch: (input: string | AgentUserContent, context: { messageId: string; principalId: string; threadId: string }) => Promise<void>;
};

export type WhatsAppChannelRuntime = {
  bot: ReturnType<typeof chatSdkChannel>["bot"];
  channel: ReturnType<typeof chatSdkChannel>["channel"];
  send: ReturnType<typeof chatSdkChannel>["send"];
  whatsapp: BaileysAdapter;
  disconnect: () => Promise<void>;
};

const audioAttachment = (audio: VoiceAudio): Attachment => ({
  type: "audio",
  data: audio.data,
  mimeType: audio.mediaType,
  ...(audio.fileName ? { name: audio.fileName } : {}),
});

const postWhatsAppVoiceRecovery = async (thread: Thread, provider: VoiceProvider): Promise<void> => {
  const audio = await synthesizeVoiceOrUndefined(provider, { text: voiceRecoveryText, languageCode: "hi-IN" });
  if (!audio) {
    await thread.post(voiceRecoveryText);
    return;
  }
  try {
    await thread.post({ markdown: "", attachments: [audioAttachment(audio)] });
  } catch {
    await thread.post(voiceRecoveryText);
  }
};

/**
 * Build and connect the staged WhatsApp transport. The returned channel uses
 * the root Eve agent; it does not create a WhatsApp-specific reporting agent.
 */
export const createWhatsAppChannel = async (options: WhatsAppChannelOptions): Promise<WhatsAppChannelRuntime> => {
  await mkdir(options.authDirectory, { recursive: true });
  const voiceProvider = options.voiceProvider ?? sarvamVoiceProvider;
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
    events: {
      "message.completed": async (eventData, channel) => {
        if (!eventData.message || eventData.finishReason === "tool-calls" || !channel.thread) return;
        const preference = voicePreferences.get("whatsapp", channel.thread.id);
        if (!preference || preference.modality === "text") {
          await channel.thread.post({ markdown: eventData.message });
          return;
        }

        const isFinalInterpretation = options.isReportReadyForReview?.(channel.thread.id) || isReportReviewMessage(eventData.message);
        const audio = await synthesizeVoiceOrUndefined(voiceProvider, {
          text: eventData.message,
          languageCode: preference.languageCode,
        });
        if (!audio) {
          await channel.thread.post({ markdown: eventData.message });
          return;
        }
        if (isFinalInterpretation) await channel.thread.post({ markdown: eventData.message });
        try {
          await channel.thread.post({ markdown: "", attachments: [audioAttachment(audio)] });
        } catch {
          if (!isFinalInterpretation) await channel.thread.post({ markdown: eventData.message });
        }
      },
    },
  });

  const handleMessage = async (thread: Thread, message: Message): Promise<void> => {
    if (message.author.isMe) return;
    let claimed = false;
    try {
      claimed = await messageDedupe.claim(message.id);
      if (!claimed) return;
      if (isWhatsAppStatusRequest(message.text)) {
        await thread.post(statusBoundaryReply);
        await messageDedupe.complete?.(message.id);
        return;
      }
      const normalized = await normalizeWhatsAppMessageWithMedia(message, {
        mediaStorage: options.mediaStorage,
        ...(options.locationSource ? { locationSource: options.locationSource } : {}),
      });
      const stagedVoiceAttachment = normalized.inbound.attachments?.find((attachment) => attachment.kind === "audio");
      const pendingInbound = normalized.copiedVoice && stagedVoiceAttachment
        ? pendingVoiceMessage(normalized.inbound, stagedVoiceAttachment)
        : normalized.inbound;
      const initialContext = await options.onInbound?.(pendingInbound);
      if (initialContext === null) {
        await messageDedupe.complete?.(message.id);
        return;
      }
      if (options.isAuthenticationPending?.(pendingInbound)) {
        await options.onAuthenticationPending?.(thread, pendingInbound);
        await messageDedupe.complete?.(message.id);
        return;
      }
      const inbound = normalized.copiedVoice && stagedVoiceAttachment
        ? await transcribeInboundVoice(pendingInbound, {
          attachment: stagedVoiceAttachment,
          data: normalized.copiedVoice.data,
          ...(normalized.copiedVoice.fileName ? { fileName: normalized.copiedVoice.fileName } : {}),
        }, voiceProvider)
        : pendingInbound;
      const voiceContext = normalized.copiedVoice && stagedVoiceAttachment
        ? await options.onVoiceTranscribed?.(inbound)
        : undefined;
      if (voiceContext === null) {
        await messageDedupe.complete?.(message.id);
        return;
      }
      if (inbound.voice && inbound.voice.status !== "transcribed") {
        await postWhatsAppVoiceRecovery(thread, voiceProvider);
        await messageDedupe.complete?.(message.id);
        return;
      }
      await thread.subscribe();
      const agentInput = whatsappInputForAgent(message, inbound, normalized.copiedMedia);
      const ingressContext = voiceContext ?? initialContext;
      const inputWithContext = ingressContext
        ? typeof agentInput === "string"
          ? `${agentInput}\n\n${ingressContext}`
          : [...agentInput, { type: "text" as const, text: ingressContext }]
        : agentInput;
      await options.dispatch(inputWithContext, {
        messageId: message.id,
        principalId: message.author.userId,
        threadId: message.threadId,
      });
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
