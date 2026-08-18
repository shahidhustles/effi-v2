import { randomBytes } from "node:crypto";
import type { ToolContext } from "eve/tools";
import {
  TelegramChannelAdapter,
  telegramConversationId,
  telegramLocation,
} from "../../src/telegram-channel-adapter.js";
import { FileEvidenceStorage, type EvidenceStorage } from "../../src/evidence-storage.js";
import { TelegramAuthenticationService } from "../../src/telegram-authentication.js";
import {
  SimulatedReportStore,
  type Conversation,
  type InboundMessage,
  type PersistedMessage,
} from "../../src/simulated-report-registration.js";
import type { TelegramMessage } from "eve/channels/telegram";

const currentTime = () => new Date().toISOString();
const telegramMessageDate = (message: TelegramMessage): string => {
  const date = message.raw.date;
  return typeof date === "number" && Number.isFinite(date) ? new Date(date * 1_000).toISOString() : currentTime();
};

const stagedAuthenticationBaseUrl = process.env.EFFI_AUTHENTICATION_BASE_URL ?? "http://localhost:3000/effi/auth/telegram";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const telegramConversationIdFromContext = (ctx: ToolContext): string => {
  const auth = ctx.session.auth.current;
  if (!auth || auth.authenticator !== "telegram-webhook") throw new Error("This reporting tool is available only for Telegram conversations.");
  const attributes: unknown = auth.attributes;
  if (!isRecord(attributes) || typeof attributes.chat_id !== "string") throw new Error("Telegram conversation identity is missing.");
  const threadId = typeof attributes.message_thread_id === "string" ? attributes.message_thread_id : undefined;
  return threadId ? `${attributes.chat_id}:${threadId}` : attributes.chat_id;
};

export const telegramReportStore = new SimulatedReportStore(currentTime, {
  authenticationBaseUrl: stagedAuthenticationBaseUrl,
  tokenFactory: () => randomBytes(24).toString("base64url"),
});

export type TelegramIngressRecord = {
  readonly inbound: InboundMessage;
  readonly conversation: Conversation;
  readonly persisted: PersistedMessage;
};

export class TelegramReportIngress {
  readonly store: SimulatedReportStore;
  readonly adapter: TelegramChannelAdapter;
  #seenMessageIds = new Set<string>();

  constructor(options: {
    store?: SimulatedReportStore;
    adapter?: TelegramChannelAdapter;
    storage?: EvidenceStorage;
  } = {}) {
    this.store = options.store ?? telegramReportStore;
    this.adapter = options.adapter ?? new TelegramChannelAdapter({
      botToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
      webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN ?? "",
      storage: options.storage ?? new FileEvidenceStorage(),
    });
  }

  async accept(message: TelegramMessage): Promise<TelegramIngressRecord | undefined> {
    const messageId = `telegram:${message.chat.id}:${message.messageId}`;
    if (this.#seenMessageIds.has(messageId)) return undefined;

    const attachments = await this.adapter.stageAttachments(message);
    const conversationId = telegramConversationId(message);
    const location = telegramLocation(message);
    const text = message.text || message.caption;
    const inbound: InboundMessage = {
      id: messageId,
      channel: "telegram",
      conversationId,
      senderId: message.from?.id ?? message.chat.id,
      receivedAt: telegramMessageDate(message),
      ...(text ? { text } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(location ? { location } : {}),
    };

    let conversation = this.store.activeConversation("telegram", conversationId);
    if (!conversation || conversation.phase === "registered") conversation = this.store.startConversation(inbound);
    const persisted = this.store.persistInbound(conversation, inbound);
    if (!persisted) return undefined;
    this.store.applyInboundFacts(conversation, persisted);
    this.#seenMessageIds.add(messageId);
    return { inbound, conversation, persisted };
  }

  contextFor(record: TelegramIngressRecord): string {
    const { inbound, persisted } = record;
    const lines = [
      "Effi has persisted this Telegram message before model processing.",
      `telegram_message_id: ${inbound.id}`,
      `conversation_id: ${inbound.conversationId}`,
    ];
    if (inbound.location) {
      lines.push(`exact_location: ${inbound.location.latitude}, ${inbound.location.longitude} (${inbound.location.source})`);
      lines.push("Use only this exact location. A typed address or landmark is not a complete location.");
    }
    if (persisted.attachments.length > 0) {
      lines.push(`effi_controlled_image_ids: ${persisted.attachments.map((attachment) => attachment.id).join(", ")}`);
      lines.push("Inspect the attached image before treating any image as accepted evidence.");
    }
    return lines.join("\n");
  }
}

export const telegramReportIngress = new TelegramReportIngress();
export const telegramAuthenticationService = new TelegramAuthenticationService(telegramReportIngress.store, telegramReportIngress.adapter);
