import {
  downloadTelegramFile,
  getTelegramFile,
  parseTelegramUpdate,
  sendTelegramMessage,
  splitTelegramMessageText,
  type TelegramAttachment,
  type TelegramBotToken,
  type TelegramCallbackQuery,
  type TelegramMessage,
  type TelegramUpdate,
} from "eve/channels/telegram";
import type { EvidenceStorage } from "./evidence-storage.js";
import { FileEvidenceStorage } from "./evidence-storage.js";
import { matchesWebhookSecret } from "./webhook-secrets.js";
import type {
  ChannelAdapter,
  ExactCoordinates,
  InboundAttachment,
  InboundMessage,
  OutboundMessage,
  WebhookVerification,
} from "./simulated-report-registration.js";

export const telegramEnvironmentKeys = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET_TOKEN", "TELEGRAM_BOT_USERNAME"] as const;

type TelegramFetch = typeof fetch;

export type TelegramChannelAdapterOptions = {
  botToken: TelegramBotToken;
  webhookSecretToken: string;
  apiBaseUrl?: string;
  fileBaseUrl?: string;
  fetch?: TelegramFetch;
  storage?: EvidenceStorage;
  now?: () => Date;
  maxRememberedEvents?: number;
  maxAttachmentBytes?: number;
};

type TelegramUpdateEnvelope = { update_id?: unknown } & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isTelegramUpdateEnvelope = (value: unknown): value is TelegramUpdateEnvelope => isRecord(value);
const finiteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const safeSegment = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "_");

const messageDate = (message: TelegramMessage, fallback: Date): string => {
  const date = message.raw.date;
  return finiteNumber(date) ? new Date(date * 1_000).toISOString() : fallback.toISOString();
};

const callbackDate = (fallback: Date): string => fallback.toISOString();

export const telegramLocation = (message: TelegramMessage): ExactCoordinates | undefined => {
  const rawLocation = isRecord(message.raw.location) ? message.raw.location : undefined;
  if (!rawLocation || !finiteNumber(rawLocation.latitude) || !finiteNumber(rawLocation.longitude)) return undefined;
  if (rawLocation.latitude < -90 || rawLocation.latitude > 90 || rawLocation.longitude < -180 || rawLocation.longitude > 180) {
    return undefined;
  }

  const explicitSource = rawLocation.effi_source ?? rawLocation.source;
  const source = explicitSource === "current_gps" || explicitSource === "selected_pin"
    ? explicitSource
    : finiteNumber(rawLocation.live_period) && rawLocation.live_period > 0
      ? "current_gps"
      : "selected_pin";

  return { source, latitude: rawLocation.latitude, longitude: rawLocation.longitude };
};

const callbackAction = (query: TelegramCallbackQuery): "confirm" | "edit" | undefined => {
  const data = query.data?.toLowerCase();
  if (data === "effi:confirm" || data === "confirm") return "confirm";
  if (data === "effi:edit" || data === "edit") return "edit";
  return undefined;
};

export const telegramConversationId = (message: Pick<TelegramMessage, "chat" | "messageThreadId">): string =>
  message.messageThreadId === undefined ? message.chat.id : `${message.chat.id}:${message.messageThreadId}`;

const callbackConversation = (query: TelegramCallbackQuery): string | undefined => {
  const chatId = query.message?.chat.id;
  if (!chatId) return undefined;
  return query.message?.messageThreadId === undefined ? chatId : `${chatId}:${query.message.messageThreadId}`;
};

const callbackId = (query: TelegramCallbackQuery): string => `telegram:callback:${safeSegment(query.id)}`;

const providerEventId = (payload: TelegramUpdateEnvelope): string | undefined => {
  if (typeof payload.update_id === "number" && Number.isFinite(payload.update_id)) return `telegram:update:${payload.update_id}`;
  if (typeof payload.update_id === "string" && payload.update_id.length > 0) return `telegram:update:${payload.update_id}`;
  return undefined;
};

const telegramTarget = (conversationId: string): { chatId: string; messageThreadId?: number } => {
  const [chatId, threadId] = conversationId.split(":", 2);
  const parsedThreadId = threadId === undefined ? undefined : Number(threadId);
  return {
    chatId: chatId ?? conversationId,
    ...(parsedThreadId !== undefined && Number.isSafeInteger(parsedThreadId) ? { messageThreadId: parsedThreadId } : {}),
  };
};

const attachmentFor = (attachment: TelegramAttachment, storageKey: string): InboundAttachment => ({
  id: attachment.fileId,
  kind: "image",
  mediaType: attachment.mediaType ?? "image/jpeg",
  platformUrl: `telegram-file:${attachment.fileId}`,
  quality: "uncertain",
  platformReference: `telegram:file:${attachment.fileId}`,
  storageKey,
});

export class TelegramChannelAdapter implements ChannelAdapter {
  readonly received: InboundMessage[] = [];
  readonly sent: OutboundMessage[] = [];
  readonly storage: EvidenceStorage;
  #onInbound?: (message: InboundMessage) => Promise<void>;
  #rememberedEvents = new Set<string>();
  #rememberedOrder: string[] = [];
  #now: () => Date;
  #maxRememberedEvents: number;
  #maxAttachmentBytes: number;

  constructor(private readonly options: TelegramChannelAdapterOptions) {
    this.storage = options.storage ?? new FileEvidenceStorage();
    this.#now = options.now ?? (() => new Date());
    this.#maxRememberedEvents = options.maxRememberedEvents ?? 10_000;
    this.#maxAttachmentBytes = options.maxAttachmentBytes ?? 10 * 1024 * 1024;
  }

  async verifyWebhook(input: WebhookVerification): Promise<boolean> {
    return matchesWebhookSecret(input.signature, this.options.webhookSecretToken);
  }

  async parseInbound(input: WebhookVerification): Promise<InboundMessage[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      return [];
    }
    if (!isTelegramUpdateEnvelope(parsed)) return [];
    const payload = parsed;
    const update = parseTelegramUpdate(payload);
    if (!update) return [];

    const eventId = providerEventId(payload) ?? this.fallbackEventId(update);
    if (eventId && this.#rememberedEvents.has(eventId)) return [];

    if (update.kind === "message" && (update.message.from?.isBot === true || update.message.chat.type === "channel")) {
      if (eventId) this.remember(eventId);
      return [];
    }

    const messages = update.kind === "message"
      ? [await this.#normalizeMessage(update.message, eventId)]
      : this.#normalizeCallback(update.callbackQuery, eventId);

    if (eventId) this.remember(eventId);
    return messages;
  }

  async send(message: OutboundMessage): Promise<void> {
    this.sent.push(message);
    const rows: Record<string, unknown>[][] = [];
    if (message.actions && message.actions.length > 0) {
      rows.push(message.actions.map((action) => {
        const id = typeof action === "string" ? action : action.id;
        const label = typeof action === "string" ? action[0]?.toUpperCase() + action.slice(1) : action.label;
        return { text: label, callback_data: `effi:${id}` };
      }));
    }
    if (message.authenticationLink) {
      rows.push([{ text: "Authenticate", url: message.authenticationLink }]);
    }

    const target = telegramTarget(message.conversationId);
    const textParts = splitTelegramMessageText(message.text);
    for (const [index, text] of textParts.entries()) {
      const body: { text: string; message_thread_id?: number; reply_markup?: Record<string, unknown> } = {
        text,
        ...(target.messageThreadId !== undefined ? { message_thread_id: target.messageThreadId } : {}),
      };
      if (index === 0 && rows.length > 0) body.reply_markup = { inline_keyboard: rows };
      await sendTelegramMessage({
        ...(this.options.apiBaseUrl ? { apiBaseUrl: this.options.apiBaseUrl } : {}),
        body,
        chatId: target.chatId,
        credentials: { botToken: this.options.botToken },
        ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      });
    }
  }

  registerInboundHandler(handler: (message: InboundMessage) => Promise<void>): void {
    this.#onInbound = handler;
  }

  async deliverWebhook(input: WebhookVerification): Promise<boolean> {
    if (!(await this.verifyWebhook(input))) return false;
    const messages = await this.parseInbound(input);
    for (const message of messages) {
      this.received.push(message);
      await this.#onInbound?.(message);
    }
    return true;
  }

  async stageAttachments(message: TelegramMessage): Promise<readonly InboundAttachment[]> {
    const imageAttachments = message.attachments.filter((attachment) =>
      (attachment.kind === "photo" || attachment.mediaType?.toLowerCase().startsWith("image/")) &&
      (attachment.size === undefined || attachment.size <= this.#maxAttachmentBytes),
    );
    return Promise.all(imageAttachments.map((attachment) => this.#normalizeAttachment(message, attachment)));
  }

  async #normalizeAttachment(message: TelegramMessage, attachment: TelegramAttachment): Promise<InboundAttachment> {
    const apiOptions = {
      ...(this.options.apiBaseUrl ? { apiBaseUrl: this.options.apiBaseUrl } : {}),
      credentials: { botToken: this.options.botToken },
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
    };
    const file = await getTelegramFile({ ...apiOptions, fileId: attachment.fileId });
    const response = await downloadTelegramFile({
      ...apiOptions,
      ...(this.options.fileBaseUrl ? { fileBaseUrl: this.options.fileBaseUrl } : {}),
      filePath: file.filePath,
    });
    if (!response.ok) throw new Error(`Telegram media download failed with HTTP ${response.status}.`);

    const storageKey = `effi/telegram/${safeSegment(message.chat.id)}/${safeSegment(message.messageId)}/${safeSegment(attachment.fileId)}`;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > this.#maxAttachmentBytes) throw new Error("Telegram image exceeds the configured size limit.");
    await this.storage.copy({
      bytes,
      mediaType: attachment.mediaType ?? response.headers.get("content-type") ?? "image/jpeg",
      sourceReference: `telegram:file:${attachment.fileId}`,
      storageKey,
    });
    return attachmentFor(attachment, storageKey);
  }

  async #normalizeMessage(message: TelegramMessage, eventId: string | undefined): Promise<InboundMessage> {
    const attachments = await this.stageAttachments(message);
    const conversationId = telegramConversationId(message);
    const text = message.text || message.caption;
    const location = telegramLocation(message);
    const inbound: InboundMessage = {
      id: `telegram:${message.chat.id}:${message.messageId}`,
      channel: "telegram",
      conversationId,
      senderId: message.from?.id ?? message.chat.id,
      receivedAt: messageDate(message, this.#now()),
      ...(eventId ? { providerEventId: eventId } : {}),
      ...(text ? { text } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(location ? { location } : {}),
    };
    return inbound;
  }

  #normalizeCallback(query: TelegramCallbackQuery, eventId: string | undefined): InboundMessage[] {
    const action = callbackAction(query);
    const conversationId = callbackConversation(query);
    if (!action || !conversationId) return [];
    return [{
      id: callbackId(query),
      channel: "telegram",
      conversationId,
      senderId: query.from.id,
      action,
      text: action,
      receivedAt: callbackDate(this.#now()),
      ...(eventId ? { providerEventId: eventId } : {}),
    }];
  }

  fallbackEventId(update: TelegramUpdate): string {
    if (update.kind === "message") return `telegram:message:${update.message.chat.id}:${update.message.messageId}`;
    return callbackId(update.callbackQuery);
  }

  remember(eventId: string): void {
    this.#rememberedEvents.add(eventId);
    this.#rememberedOrder.push(eventId);
    while (this.#rememberedOrder.length > this.#maxRememberedEvents) {
      const oldest = this.#rememberedOrder.shift();
      if (oldest) this.#rememberedEvents.delete(oldest);
    }
  }
}
