import type { IssueCategory } from "@effi/domain";
import { z } from "zod";
import { SharedReportIngress, type ReportIngressRecord } from "./report-ingress.js";

export type Channel = "telegram" | "whatsapp";
export type ExactCoordinates = { source: "current_gps" | "selected_pin"; latitude: number; longitude: number };
export type PhotoQuality = "satisfactory" | "insufficient" | "unrelated" | "unusable" | "uncertain" | "undecodable";
export type PhotoInspectionResult = "accepted" | "unrelated" | "uncertain" | "undecodable";
export type ReportAction = "confirm" | "edit";
export type InboundAction = ReportAction | "help" | "cancel";
export type InboundAttachment = {
  id: string;
  kind: "image";
  mediaType: string;
  platformUrl: string;
  quality?: PhotoQuality;
  decodable?: boolean;
  inspected?: boolean;
  platformReference?: string;
  storageKey?: string;
};
export type StoredAttachment = Omit<InboundAttachment, "platformUrl"> & {
  platformReference: string;
  storageKey: string;
  decodeStatus?: "decoded" | "undecodable";
};
export type InboundMessage = {
  id: string;
  providerEventId?: string;
  channel: Channel;
  conversationId: string;
  senderId: string;
  text?: string;
  voiceTranscript?: string;
  action?: InboundAction;
  attachments?: readonly InboundAttachment[];
  location?: ExactCoordinates;
  receivedAt: string;
};
export type PersistedMessage = Omit<InboundMessage, "attachments"> & { attachments: readonly StoredAttachment[] };
export type ReportInterpretation = { issue: string; category: IssueCategory; location: ExactCoordinates; primaryEvidence: readonly StoredAttachment[] };
export type OutboundMessage = {
  channel: Channel;
  conversationId: string;
  text: string;
  interpretation?: ReportInterpretation;
  authenticationLink?: string;
  actions?: readonly (ReportAction | { id: ReportAction; label: string })[];
};
export type WebhookVerification = { signature: string | null; timestamp: string | null; rawBody: string };

export interface ChannelAdapter {
  verifyWebhook(input: WebhookVerification): Promise<boolean>;
  parseInbound(input: WebhookVerification): Promise<InboundMessage[]>;
  send(message: OutboundMessage): Promise<void>;
  registerInboundHandler(handler: (message: InboundMessage) => Promise<void>): void;
}

export const botEnvironmentKeys = ["BOT_WEBHOOK_SECRET"] as const;

export class FakeChannelAdapter implements ChannelAdapter {
  readonly received: InboundMessage[] = [];
  readonly sent: OutboundMessage[] = [];
  #onInbound?: (message: InboundMessage) => Promise<void>;

  async verifyWebhook(): Promise<boolean> { return true; }
  async parseInbound(): Promise<InboundMessage[]> { return []; }
  async send(message: OutboundMessage): Promise<void> { this.sent.push(message); }
  registerInboundHandler(handler: (message: InboundMessage) => Promise<void>): void { this.#onInbound = handler; }
  async deliver(message: InboundMessage): Promise<void> {
    this.received.push(message);
    await this.#onInbound?.(message);
  }
}

export type Conversation = {
  channel: Channel;
  conversationId: string;
  senderId: string;
  sessionId: string;
  phase: "gathering" | "awaiting_confirmation" | "authentication_pending" | "registered" | "cancelled";
  messages: PersistedMessage[];
  acceptedEvidence: StoredAttachment[];
  editing?: "choose" | "issue" | "photo" | "location";
  reviewedInterpretation?: ReportInterpretation;
  issue?: string;
  location?: ExactCoordinates;
};
export type PendingSubmission = {
  readonly id: string;
  readonly authenticationLink: string;
  readonly expiresAt: string;
  readonly idempotencyKey: string;
  readonly interpretation: ReportInterpretation;
  readonly conversation: Conversation;
};
export type PendingSubmissionReceipt = { authenticationLink: string; pendingSubmissionId: string };
export type RegisteredReport = {
  id: string;
  citizenId: string;
  interpretation: ReportInterpretation;
  primaryEvidence: readonly { attachmentId: string; storageKey: string }[];
  location: ExactCoordinates;
  conversation: Conversation;
};

export type ReportStoreOptions = {
  authenticationBaseUrl?: string;
  authenticationTtlMs?: number;
  tokenFactory?: () => string;
};

export type AuthenticationInput = {
  authenticationLink: string;
  citizenId: string;
  channel?: Channel;
  conversationId?: string;
  idempotencyKey?: string | undefined;
};

const conversationKey = (channel: Channel, conversationId: string) => `${channel}:${conversationId}`;
const copyLocation = (location: ExactCoordinates): ExactCoordinates => ({ ...location });
const copyAttachment = (attachment: StoredAttachment): StoredAttachment => ({ ...attachment });
const copyMessage = (message: PersistedMessage): PersistedMessage => ({ ...message, attachments: message.attachments.map(copyAttachment) });
const copyInterpretation = (interpretation: ReportInterpretation): ReportInterpretation => ({
  ...interpretation,
  location: copyLocation(interpretation.location),
  primaryEvidence: interpretation.primaryEvidence.map(copyAttachment),
});
const copyConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: conversation.messages.map(copyMessage),
  acceptedEvidence: conversation.acceptedEvidence.map(copyAttachment),
  ...(conversation.location ? { location: copyLocation(conversation.location) } : {}),
  ...(conversation.reviewedInterpretation ? { reviewedInterpretation: copyInterpretation(conversation.reviewedInterpretation) } : {}),
});
const authenticationCallbackSchema = z.object({
  authenticationLink: z.string().min(1),
  citizenId: z.string().min(1),
  channel: z.enum(["telegram", "whatsapp"]).optional(),
  conversationId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
});
export const categoryForIssue = (issue: string): IssueCategory => {
  const text = issue.toLowerCase();
  if (text.includes("pothole") || text.includes("road")) return "roads";
  if (text.includes("drain") || text.includes("garbage")) return "sanitation";
  if (text.includes("water") || text.includes("leak")) return "water";
  if (text.includes("light")) return "lighting";
  return "other";
};
const inboundAttachmentSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("image"),
  mediaType: z.string().min(1),
  platformUrl: z.string(),
  quality: z.enum(["satisfactory", "insufficient", "unrelated", "unusable", "uncertain", "undecodable"]).optional(),
  decodable: z.boolean().optional(),
  inspected: z.boolean().optional(),
  platformReference: z.string().optional(),
  storageKey: z.string().optional(),
});
const inboundMessageEnvelopeSchema = z.object({
  id: z.string().min(1),
  providerEventId: z.string().min(1).optional(),
  channel: z.enum(["telegram", "whatsapp"]),
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  text: z.string().optional(),
  voiceTranscript: z.string().optional(),
  action: z.enum(["confirm", "edit", "help", "cancel"]).optional(),
  attachments: z.array(z.unknown()).optional(),
  location: z.object({
    source: z.enum(["current_gps", "selected_pin"]),
    latitude: z.number().finite().gte(-90).lte(90),
    longitude: z.number().finite().gte(-180).lte(180),
  }).optional(),
  receivedAt: z.string().min(1),
});
const normalizeInboundAttachment = (attachment: unknown, fallbackId: string): InboundAttachment => {
  const parsed = inboundAttachmentSchema.safeParse(attachment);
  if (parsed.success) {
    return {
      id: parsed.data.id,
      kind: parsed.data.kind,
      mediaType: parsed.data.mediaType,
      platformUrl: parsed.data.platformUrl,
      ...(parsed.data.quality === undefined ? {} : { quality: parsed.data.quality }),
      ...(parsed.data.decodable === undefined ? {} : { decodable: parsed.data.decodable }),
      ...(parsed.data.inspected === undefined ? {} : { inspected: parsed.data.inspected }),
      ...(parsed.data.platformReference === undefined ? {} : { platformReference: parsed.data.platformReference }),
      ...(parsed.data.storageKey === undefined ? {} : { storageKey: parsed.data.storageKey }),
    };
  }
  const raw = typeof attachment === "object" && attachment !== null ? (attachment as Record<string, unknown>) : {};
  return {
    id: typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : fallbackId,
    kind: "image",
    mediaType: typeof raw.mediaType === "string" ? raw.mediaType : "application/octet-stream",
    platformUrl: typeof raw.platformUrl === "string" ? raw.platformUrl : "",
    quality: "undecodable",
    decodable: false,
  };
};
const normalizeInboundMessage = (input: unknown): InboundMessage | undefined => {
  const parsed = inboundMessageEnvelopeSchema.safeParse(input);
  if (!parsed.success) return undefined;
  const value = parsed.data;
  return {
    id: value.id,
    ...(value.providerEventId === undefined ? {} : { providerEventId: value.providerEventId }),
    channel: value.channel,
    conversationId: value.conversationId,
    senderId: value.senderId,
    ...(value.text === undefined ? {} : { text: value.text }),
    ...(value.voiceTranscript === undefined ? {} : { voiceTranscript: value.voiceTranscript }),
    ...(value.action === undefined ? {} : { action: value.action }),
    ...(value.attachments === undefined ? {} : { attachments: value.attachments.map((attachment, index) => normalizeInboundAttachment(attachment, `unreadable-image-${value.id}-${index}`)) }),
    ...(value.location === undefined ? {} : { location: value.location }),
    receivedAt: value.receivedAt,
  };
};
const isUndecodable = (attachment: { quality?: PhotoQuality; decodable?: boolean; decodeStatus?: "decoded" | "undecodable" }): boolean =>
  attachment.decodeStatus === "undecodable" || attachment.decodable === false || attachment.quality === "undecodable";
const decodeStatusFor = (attachment: InboundAttachment): "decoded" | "undecodable" => {
  const hasImageMedia = typeof attachment.mediaType === "string" && attachment.mediaType.startsWith("image/");
  const hasPlatformReference = typeof attachment.platformUrl === "string" && attachment.platformUrl.trim().length > 0;
  return isUndecodable(attachment) || !hasImageMedia || !hasPlatformReference ? "undecodable" : "decoded";
};
type InboundText = Pick<InboundMessage, "text" | "voiceTranscript">;
const textFor = (message: InboundText): string | undefined => {
  const text = message.text?.trim() || message.voiceTranscript?.trim();
  return text || undefined;
};
const actionFor = (message: Pick<InboundMessage, "text" | "voiceTranscript" | "action">): InboundAction | undefined => {
  if (message.action) return message.action;
  const text = textFor(message)?.toLowerCase();
  if (text === "confirm" || text === "edit" || text === "help" || text === "cancel") return text;
  return undefined;
};
const containsAny = (text: string | undefined, words: readonly string[]): boolean => {
  const normalized = text?.toLowerCase() ?? "";
  return words.some((word) => normalized.includes(word));
};
const photoRetryText = (result: Exclude<PhotoInspectionResult, "accepted">): string => {
  if (result === "undecodable") return "I couldn't read that image. Please resend it as a clear photo of the civic issue.";
  if (result === "unrelated") return "That photo doesn't clearly show the reported issue. Please send a photo focused on the issue.";
  return "I can't tell enough from that photo. Please send a clearer photo that shows the issue.";
};

export class SimulatedReportStore {
  #conversations = new Map<string, Conversation>();
  #pendingByLink = new Map<string, PendingSubmission>();
  #pendingByConversation = new Map<string, PendingSubmission>();
  #reportsByIdempotencyKey = new Map<string, RegisteredReport>();
  #processedMessageKeys = new Set<string>();
  #sessionCount = 0;
  #pendingCount = 0;
  #reportCount = 0;

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly options: ReportStoreOptions = {},
  ) {}

  activeConversation(channel: Channel, id: string): Conversation | undefined { return this.#conversations.get(conversationKey(channel, id)); }
  latestMessage(channel: Channel, id: string): PersistedMessage | undefined { return this.activeConversation(channel, id)?.messages.at(-1); }
  persistedMessage(channel: Channel, conversationId: string, messageId: string): PersistedMessage | undefined {
    return this.activeConversation(channel, conversationId)?.messages.find((message) => message.id === messageId);
  }
  reports(): readonly RegisteredReport[] { return [...this.#reportsByIdempotencyKey.values()]; }
  report(id: string): RegisteredReport | undefined { return this.reports().find((report) => report.id === id); }
  hasPersistedMessage(message: Pick<InboundMessage, "channel" | "id">): boolean { return this.#processedMessageKeys.has(`${message.channel}:${message.id}`); }

  startConversation(message: InboundMessage): Conversation {
    const conversation: Conversation = {
      channel: message.channel,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sessionId: `session_${++this.#sessionCount}`,
      phase: "gathering",
      messages: [],
      acceptedEvidence: [],
    };
    this.#conversations.set(conversationKey(message.channel, message.conversationId), conversation);
    return conversation;
  }

  persistInbound(conversation: Conversation, message: InboundMessage): PersistedMessage | undefined {
    const messageKey = `${message.channel}:${message.id}`;
    if (this.#processedMessageKeys.has(messageKey) || conversation.messages.some((saved) => saved.id === message.id)) return undefined;
    const attachments = (message.attachments ?? []).map((attachment, index) => {
      const normalized = normalizeInboundAttachment(attachment, `unreadable-image-${message.id}-${index}`);
      return {
        ...normalized,
        platformReference: normalized.platformReference ?? normalized.platformUrl,
        storageKey: normalized.storageKey ?? `effi/${message.channel}/${message.conversationId}/${message.id}/${normalized.id}`,
        decodeStatus: decodeStatusFor(normalized),
      };
    });
    const persisted: PersistedMessage = { ...message, attachments };
    conversation.messages.push(persisted);
    this.#processedMessageKeys.add(messageKey);
    return persisted;
  }

  applyInboundFacts(conversation: Conversation, message: PersistedMessage): void {
    const text = message.text?.trim() || message.voiceTranscript?.trim();
    if (!conversation.issue && text) conversation.issue = text;
    if (message.location) conversation.location = copyLocation(message.location);
  }

  attachment(channel: Channel, conversationId: string, attachmentId: string): StoredAttachment | undefined {
    const conversation = this.activeConversation(channel, conversationId);
    const attachment = conversation ? this.#findAttachment(conversation, attachmentId) : undefined;
    return attachment ? copyAttachment(attachment) : undefined;
  }

  createPending(conversation: Conversation, interpretation: ReportInterpretation, receivedAt: string): PendingSubmissionReceipt {
    const key = conversationKey(conversation.channel, conversation.conversationId);
    const existing = this.#pendingByConversation.get(key);
    if (existing) return { authenticationLink: existing.authenticationLink, pendingSubmissionId: existing.id };

    const id = `pending_${++this.#pendingCount}`;
    const token = this.options.tokenFactory?.() ?? id;
    const authenticationLink = this.options.authenticationBaseUrl
      ? `${this.options.authenticationBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(token)}`
      : `simulated-auth://${id}`;
    const pending: PendingSubmission = {
      id,
      authenticationLink,
      expiresAt: new Date(Date.parse(receivedAt) + (this.options.authenticationTtlMs ?? 5 * 60_000)).toISOString(),
      idempotencyKey: `report:${conversation.channel}:${conversation.conversationId}:${id}`,
      interpretation: copyInterpretation(interpretation),
      conversation: copyConversation(conversation),
    };
    this.#pendingByLink.set(pending.authenticationLink, pending);
    this.#pendingByConversation.set(key, pending);
    return { authenticationLink: pending.authenticationLink, pendingSubmissionId: pending.id };
  }

  prepareSubmission(input: {
    channel: Channel;
    conversationId: string;
    issue: string;
    category: IssueCategory;
    acceptedAttachmentIds: readonly string[];
    receivedAt: string;
  }): PendingSubmissionReceipt {
    const conversation = this.activeConversation(input.channel, input.conversationId);
    if (!conversation) throw new Error("No active report conversation exists.");
    const existing = this.#pendingByConversation.get(conversationKey(input.channel, input.conversationId));
    if (existing) return { authenticationLink: existing.authenticationLink, pendingSubmissionId: existing.id };
    const latestMessage = conversation.messages.at(-1);
    const explicitlyConfirmed = latestMessage !== undefined && actionFor(latestMessage) === "confirm";
    const canPrepare = conversation.phase === "awaiting_confirmation"
      || (conversation.phase === "gathering" && explicitlyConfirmed);
    if (!canPrepare) {
      throw new Error("The complete interpretation must be reviewed before submission.");
    }
    if (!conversation.location) throw new Error("An exact location is required before submission.");

    const attachmentById = new Map(conversation.messages.flatMap((message) => message.attachments).map((attachment) => [attachment.id, attachment]));
    const primaryEvidence = [...new Set(input.acceptedAttachmentIds)].map((id) => {
      const attachment = attachmentById.get(id);
      if (!attachment) throw new Error("Every accepted photo must be present in the conversation.");
      if (!attachment.inspected) throw new Error("Every accepted photo must be inspected before submission.");
      if (attachment.quality !== "satisfactory") throw new Error("Every accepted photo must be explicitly accepted before submission.");
      return attachment;
    });
    if (primaryEvidence.length === 0) throw new Error("At least one accepted photo is required before submission.");

    conversation.issue = input.issue.trim();
    conversation.acceptedEvidence = primaryEvidence;
    conversation.phase = "authentication_pending";
    return this.createPending(conversation, {
      issue: conversation.issue,
      category: input.category,
      location: copyLocation(conversation.location),
      primaryEvidence: primaryEvidence.map(copyAttachment),
    }, input.receivedAt);
  }

  markAttachmentInspected(channel: Channel, conversationId: string, attachmentId: string): StoredAttachment {
    return this.#updateAttachment(channel, conversationId, attachmentId, { inspected: true });
  }

  recordAttachmentQuality(
    channel: Channel,
    conversationId: string,
    attachmentId: string,
    quality: PhotoQuality,
  ): StoredAttachment {
    const conversation = this.activeConversation(channel, conversationId);
    const attachment = conversation ? this.#findAttachment(conversation, attachmentId) : undefined;
    if (!conversation || !attachment) throw new Error("The staged image is not present in this conversation.");
    if (!attachment.inspected) throw new Error("Inspect the staged image before recording its assessment.");
    const updated = this.#updateAttachment(channel, conversationId, attachmentId, { quality });
    if (quality === "satisfactory") {
      if (!conversation.acceptedEvidence.some((evidence) => evidence.id === attachmentId)) conversation.acceptedEvidence.push(updated);
    } else {
      conversation.acceptedEvidence = conversation.acceptedEvidence.filter((evidence) => evidence.id !== attachmentId);
    }
    return updated;
  }

  #findAttachment(conversation: Conversation, attachmentId: string): StoredAttachment | undefined {
    return conversation.messages.flatMap((message) => message.attachments).find((attachment) => attachment.id === attachmentId);
  }

  #updateAttachment(channel: Channel, conversationId: string, attachmentId: string, update: Partial<StoredAttachment>): StoredAttachment {
    const conversation = this.activeConversation(channel, conversationId);
    if (!conversation) throw new Error("No active report conversation exists.");
    let updated: StoredAttachment | undefined;
    conversation.messages = conversation.messages.map((message) => ({
      ...message,
      attachments: message.attachments.map((attachment) => {
        if (attachment.id !== attachmentId) return attachment;
        updated = { ...attachment, ...update };
        return updated;
      }),
    }));
    if (!updated) throw new Error("The staged image is not present in this conversation.");
    conversation.acceptedEvidence = conversation.acceptedEvidence.map((attachment) =>
      attachment.id === attachmentId ? { ...attachment, ...update } : attachment,
    );
    return copyAttachment(updated);
  }

  cancelPending(conversation: Conversation): boolean {
    let cancelled = false;
    for (const [authenticationLink, pending] of this.#pendingByLink) {
      if (pending.conversation.channel !== conversation.channel || pending.conversation.conversationId !== conversation.conversationId) continue;
      this.#pendingByLink.delete(authenticationLink);
      this.#pendingByConversation.delete(conversationKey(conversation.channel, conversation.conversationId));
      cancelled = true;
    }
    return cancelled;
  }

  authenticate(
    authenticationLink: string,
    citizenId: string,
    binding: Pick<AuthenticationInput, "channel" | "conversationId"> = {},
  ): RegisteredReport {
    const pending = this.#pendingByLink.get(authenticationLink);
    if (!pending) throw new Error("Unknown simulated authentication link.");
    if (
      (binding.channel !== undefined && pending.conversation.channel !== binding.channel) ||
      (binding.conversationId !== undefined && pending.conversation.conversationId !== binding.conversationId)
    ) {
      const channelName = pending.conversation.channel === "telegram" ? "Telegram" : "WhatsApp";
      throw new Error(`This authentication link is bound to the original ${channelName} conversation.`);
    }
    const existing = this.#reportsByIdempotencyKey.get(pending.idempotencyKey);
    if (existing) {
      if (existing.citizenId !== citizenId) throw new Error("This simulated authentication link has already been used.");
      return existing;
    }
    if (Date.parse(this.now()) > Date.parse(pending.expiresAt)) throw new Error("The simulated authentication link has expired.");

    const report: RegisteredReport = {
      id: `report_${++this.#reportCount}`,
      citizenId,
      interpretation: copyInterpretation(pending.interpretation),
      primaryEvidence: pending.interpretation.primaryEvidence.map((attachment) => ({ attachmentId: attachment.id, storageKey: attachment.storageKey })),
      location: copyLocation(pending.interpretation.location),
      conversation: copyConversation(pending.conversation),
    };
    this.#reportsByIdempotencyKey.set(pending.idempotencyKey, report);
    return report;
  }
}

export class FakeVisionReportModel {
  inspect(attachment: StoredAttachment): PhotoInspectionResult {
    if (isUndecodable(attachment)) return "undecodable";
    if (attachment.quality === "satisfactory") return "accepted";
    if (attachment.quality === "unrelated" || attachment.quality === "unusable") return "unrelated";
    return "uncertain";
  }
  interpret(conversation: Conversation): ReportInterpretation | undefined {
    if (!conversation.issue || !conversation.location || conversation.acceptedEvidence.length === 0) return undefined;
    return { issue: conversation.issue, category: categoryForIssue(conversation.issue), location: copyLocation(conversation.location), primaryEvidence: conversation.acceptedEvidence.map(copyAttachment) };
  }
}

type PendingTurn = {
  records: ReportIngressRecord[];
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

export class SimulatedReportRegistration {
  readonly adapter: ChannelAdapter;
  readonly store: SimulatedReportStore;
  readonly model: FakeVisionReportModel;
  readonly #ingress: SharedReportIngress;
  readonly #pendingTurns = new Map<string, PendingTurn>();

  constructor({ adapter, store, model }: { adapter: ChannelAdapter; store: SimulatedReportStore; model: FakeVisionReportModel }) {
    this.adapter = adapter;
    this.store = store;
    this.model = model;
    this.#ingress = new SharedReportIngress(store);
    adapter.registerInboundHandler((message) => this.receive(message));
  }

  async receive(input: unknown): Promise<void> {
    const message = normalizeInboundMessage(input);
    if (!message) return;
    const record = this.#ingress.accept(message);
    if (!record) return;
    return this.#enqueue(record);
  }

  #enqueue(record: ReportIngressRecord): Promise<void> {
    const key = `${record.inbound.channel}:${record.inbound.conversationId}`;
    let pending = this.#pendingTurns.get(key);
    if (!pending) {
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<void>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      pending = { records: [], promise, resolve, reject };
      this.#pendingTurns.set(key, pending);
      queueMicrotask(() => void this.#runPendingTurn(key, pending!));
    }
    pending.records.push(record);
    return pending.promise;
  }

  async #runPendingTurn(key: string, pending: PendingTurn): Promise<void> {
    try {
      await this.#processTurn(pending.records);
      pending.resolve();
    } catch (error) {
      pending.reject(error);
    } finally {
      if (this.#pendingTurns.get(key) === pending) this.#pendingTurns.delete(key);
    }
  }

  async #processTurn(records: readonly ReportIngressRecord[]): Promise<void> {
    const first = records[0];
    if (!first) return;
    if (await this.#handleAuthenticationPending(records)) return;
    if (records.length === 1) {
      await this.#processMessage(first);
      return;
    }

    const conversation = first.conversation;
    if (conversation.phase === "awaiting_confirmation" || records.some(({ inbound }) => actionFor(inbound) !== undefined)) {
      for (const record of records) await this.#processMessage(record);
      return;
    }

    let rejected: { record: ReportIngressRecord; result: Exclude<PhotoInspectionResult, "accepted"> } | undefined;
    for (const record of records) {
      const text = textFor(record.inbound);
      if (text) conversation.issue = text;
      if (record.persisted.location) conversation.location = copyLocation(record.persisted.location);
      const result = this.#inspectAttachments(conversation, record.persisted);
      if (result) rejected ??= { record, result };
    }
    if (rejected) {
      await this.#reply(rejected.record.inbound, photoRetryText(rejected.result));
      return;
    }

    const interpretation = this.model.interpret(conversation);
    const latest = records.at(-1);
    if (interpretation && latest) {
      conversation.phase = "awaiting_confirmation";
      conversation.reviewedInterpretation = copyInterpretation(interpretation);
      await this.#reply(latest.inbound, this.reviewText(interpretation), { interpretation, actions: ["confirm", "edit"] });
      return;
    }
    if (latest) await this.#reply(latest.inbound, this.nextClarification(conversation));
  }

  async #handleAuthenticationPending(records: readonly ReportIngressRecord[]): Promise<boolean> {
    const first = records[0];
    if (!first || first.conversation.phase !== "authentication_pending") return false;

    const cancel = records.find(({ inbound }) => actionFor(inbound) === "cancel");
    if (cancel) {
      this.store.cancelPending(first.conversation);
      first.conversation.phase = "cancelled";
      await this.#reply(cancel.inbound, "Okay, I cancelled this pending complaint. Nothing was submitted. Send a new message whenever you want to start again.");
    } else {
      const latest = records.at(-1);
      if (latest) await this.#reply(latest.inbound, "Your report is ready. Complete the authentication link to register it.");
    }
    return true;
  }

  async #processMessage(record: ReportIngressRecord): Promise<void> {
    const { inbound: message, conversation, persisted } = record;
    const action = actionFor(message);

    if (action === "cancel") {
      conversation.phase = "cancelled";
      delete conversation.editing;
      delete conversation.reviewedInterpretation;
      await this.#reply(message, "Okay, I cancelled this complaint. Nothing was submitted. Send a new message whenever you want to start again.");
      return;
    }
    if (action === "help") {
      await this.#reply(message, this.helpText(conversation));
      return;
    }

    if (conversation.phase === "awaiting_confirmation") {
      if (await this.#handleConfirmationInput(conversation, message, persisted, action)) return;
    } else {
      if (action === "confirm" || action === "edit") {
        await this.#reply(message, this.nextClarification(conversation));
        return;
      }
      const text = textFor(message);
      if (text) conversation.issue = text;
    }

    if (persisted.location) {
      conversation.location = copyLocation(persisted.location);
      if (conversation.editing === "location") delete conversation.editing;
    }

    const photoResult = this.#inspectAttachments(conversation, persisted);
    if (photoResult) {
      await this.#reply(message, photoRetryText(photoResult));
      return;
    }

    const interpretation = this.model.interpret(conversation);
    if (interpretation) {
      conversation.phase = "awaiting_confirmation";
      conversation.reviewedInterpretation = copyInterpretation(interpretation);
      await this.#reply(message, this.reviewText(interpretation), { interpretation, actions: ["confirm", "edit"] });
      return;
    }
    await this.#reply(message, this.nextClarification(conversation));
  }

  async #handleConfirmationInput(conversation: Conversation, message: InboundMessage, persisted: PersistedMessage, action: InboundAction | undefined): Promise<boolean> {
    const text = textFor(message);
    if (action === "confirm") {
      if (!conversation.reviewedInterpretation) {
        await this.#reply(message, "Please finish the current edit before confirming this report.");
        return true;
      }
      const pending = this.store.createPending(conversation, conversation.reviewedInterpretation, message.receivedAt);
      conversation.phase = "authentication_pending";
      delete conversation.editing;
      delete conversation.reviewedInterpretation;
      await this.#reply(message, "Confirm your identity to submit this report.", { authenticationLink: pending.authenticationLink });
      return true;
    }
    if (action === "edit") {
      delete conversation.reviewedInterpretation;
      conversation.editing = "choose";
      await this.#reply(message, "Which detail should I change: the issue, the photo, or the location?");
      return true;
    }

    if (conversation.editing === "choose") {
      if (persisted.attachments.length > 0 || containsAny(text, ["photo", "evidence"])) conversation.editing = "photo";
      else if (persisted.location || containsAny(text, ["location", "pin"])) conversation.editing = "location";
      else if (containsAny(text, ["issue", "description"])) conversation.editing = "issue";
      else {
        await this.#reply(message, "Please choose one detail to change: the issue, the photo, or the location.");
        return true;
      }
    } else if (!conversation.editing) {
      if (persisted.attachments.length > 0) conversation.editing = "photo";
      else if (persisted.location || containsAny(text, ["location", "pin"])) conversation.editing = "location";
      else if (containsAny(text, ["photo", "evidence"])) conversation.editing = "photo";
      else if (text) conversation.editing = "issue";
    }

    delete conversation.reviewedInterpretation;
    if (conversation.editing === "photo") {
      conversation.acceptedEvidence = [];
      if (persisted.attachments.length === 0) {
        await this.#reply(message, "Please send a replacement photo that clearly shows the civic issue.");
        return true;
      }
    } else if (conversation.editing === "location" && !persisted.location) {
      await this.#reply(message, "Please share the corrected current GPS location or select the corrected location pin.");
      return true;
    } else if (conversation.editing === "issue") {
      if (!text || text.toLowerCase() === "issue" || text.toLowerCase() === "description") {
        await this.#reply(message, "Please describe the corrected civic issue.");
        return true;
      }
      conversation.issue = text;
      delete conversation.editing;
    }
    return false;
  }

  #inspectAttachments(conversation: Conversation, message: PersistedMessage): Exclude<PhotoInspectionResult, "accepted"> | undefined {
    if (message.attachments.length === 0) return undefined;
    const inspections = message.attachments.map((attachment) => ({
      attachment,
      result: isUndecodable(attachment) ? ("undecodable" as const) : this.model.inspect(attachment),
    }));
    for (const { attachment, result } of inspections) {
      if (result === "accepted") conversation.acceptedEvidence.push(attachment);
    }
    const rejected = inspections.find(({ result }) => result !== "accepted");
    if (!rejected) delete conversation.editing;
    if (!rejected || rejected.result === "accepted") return undefined;
    return rejected.result;
  }

  async completeAuthentication(input: AuthenticationInput): Promise<{ report: RegisteredReport }> {
    const { authenticationLink, citizenId, channel, conversationId } = authenticationCallbackSchema.parse(input);
    const report = this.store.authenticate(authenticationLink, citizenId, {
      ...(channel === undefined ? {} : { channel }),
      ...(conversationId === undefined ? {} : { conversationId }),
    });
    const conversation = this.store.activeConversation(report.conversation.channel, report.conversation.conversationId);
    if (conversation?.phase !== "registered") {
      if (conversation) conversation.phase = "registered";
      await this.adapter.send({ channel: report.conversation.channel, conversationId: report.conversation.conversationId, text: `Your report has been registered. Report ID: ${report.id}` });
    }
    return { report };
  }

  #reply(inbound: InboundMessage, text: string, extra: Omit<OutboundMessage, "channel" | "conversationId" | "text"> = {}): Promise<void> {
    return this.adapter.send({ channel: inbound.channel, conversationId: inbound.conversationId, text, ...extra });
  }

  helpText(conversation: Conversation): string {
    if (conversation.editing === "photo") return "I can help. Please send one clear photo focused on the civic issue.";
    if (conversation.phase === "awaiting_confirmation" && conversation.reviewedInterpretation) return "I can help. Choose Edit to change one detail, or Confirm when the complete interpretation is correct.";
    return `I can help. ${this.nextClarification(conversation)}`;
  }

  nextClarification(conversation: Conversation): string {
    if (!conversation.issue) return "Please describe the civic issue.";
    if (conversation.acceptedEvidence.length === 0) return "Please send a clear photo of the issue.";
    return "Please share your current GPS location or select the exact location pin.";
  }

  reviewText(interpretation: ReportInterpretation): string {
    const { latitude, longitude } = interpretation.location;
    const evidence = interpretation.primaryEvidence.map((attachment) => attachment.id).join(", ");
    return `Review your report: ${interpretation.issue}. Category: ${interpretation.category}. Exact location: ${latitude}, ${longitude}. Accepted photo evidence: ${evidence}. Reply confirm to continue, or send a correction.`;
  }
}
