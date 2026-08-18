import type { IssueCategory } from "@effi/domain";
import { z } from "zod";

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
  quality: PhotoQuality;
  decodable?: boolean;
};
export type StoredAttachment = Omit<InboundAttachment, "platformUrl"> & {
  platformReference: string;
  storageKey: string;
  decodeStatus?: "decoded" | "undecodable";
};
export type InboundMessage = {
  id: string;
  channel: Channel;
  conversationId: string;
  senderId: string;
  text?: string;
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
  actions?: readonly ReportAction[];
};
export type WebhookVerification = { signature: string | null; timestamp: string | null; rawBody: string };

export interface ChannelAdapter {
  verifyWebhook(input: WebhookVerification): Promise<boolean>;
  parseInbound(input: WebhookVerification): Promise<InboundMessage[]>;
  send(message: OutboundMessage): Promise<void>;
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
type PendingSubmissionReceipt = { authenticationLink: string };
export type RegisteredReport = {
  id: string;
  citizenId: string;
  interpretation: ReportInterpretation;
  primaryEvidence: readonly { attachmentId: string; storageKey: string }[];
  location: ExactCoordinates;
  conversation: Conversation;
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
  authenticationLink: z.string().startsWith("simulated-auth://"),
  citizenId: z.string().min(1),
});
const categoryFor = (issue: string): IssueCategory => {
  const text = issue.toLowerCase();
  if (text.includes("pothole") || text.includes("road")) return "roads";
  if (text.includes("drain") || text.includes("garbage")) return "sanitation";
  if (text.includes("water") || text.includes("leak")) return "water";
  if (text.includes("light")) return "lighting";
  return "other";
};
const decodeStatusFor = (attachment: InboundAttachment): "decoded" | "undecodable" => {
  const hasImageMedia = typeof attachment.mediaType === "string" && attachment.mediaType.startsWith("image/");
  const hasPlatformReference = typeof attachment.platformUrl === "string" && attachment.platformUrl.trim().length > 0;
  return attachment.decodable === false || attachment.quality === "undecodable" || !hasImageMedia || !hasPlatformReference ? "undecodable" : "decoded";
};
const actionFor = (message: InboundMessage): InboundAction | undefined => {
  if (message.action) return message.action;
  const text = message.text?.trim().toLowerCase();
  if (text === "confirm" || text === "edit" || text === "help" || text === "cancel") return text;
  return undefined;
};
const textFor = (message: InboundMessage): string | undefined => {
  const text = message.text?.trim();
  return text || undefined;
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
  #reportsByIdempotencyKey = new Map<string, RegisteredReport>();
  #sessionCount = 0;
  #pendingCount = 0;
  #reportCount = 0;

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  activeConversation(channel: Channel, id: string): Conversation | undefined { return this.#conversations.get(conversationKey(channel, id)); }
  reports(): readonly RegisteredReport[] { return [...this.#reportsByIdempotencyKey.values()]; }
  report(id: string): RegisteredReport | undefined { return this.reports().find((report) => report.id === id); }

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
    if (conversation.messages.some((saved) => saved.id === message.id)) return undefined;
    const attachments = (message.attachments ?? []).map((attachment) => ({
      ...attachment,
      platformReference: attachment.platformUrl,
      storageKey: `effi/${message.channel}/${message.conversationId}/${message.id}/${attachment.id}`,
      decodeStatus: decodeStatusFor(attachment),
    }));
    const persisted: PersistedMessage = { ...message, attachments };
    conversation.messages.push(persisted);
    return persisted;
  }

  createPending(conversation: Conversation, interpretation: ReportInterpretation, receivedAt: string): PendingSubmissionReceipt {
    const id = `pending_${++this.#pendingCount}`;
    const pending: PendingSubmission = {
      id,
      authenticationLink: `simulated-auth://${id}`,
      expiresAt: new Date(Date.parse(receivedAt) + 5 * 60_000).toISOString(),
      idempotencyKey: `report:${conversation.channel}:${conversation.conversationId}:${id}`,
      interpretation: copyInterpretation(interpretation),
      conversation: copyConversation(conversation),
    };
    this.#pendingByLink.set(pending.authenticationLink, pending);
    return { authenticationLink: pending.authenticationLink };
  }

  authenticate(authenticationLink: string, citizenId: string): RegisteredReport {
    const pending = this.#pendingByLink.get(authenticationLink);
    if (!pending) throw new Error("Unknown simulated authentication link.");
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
    if (attachment.decodeStatus === "undecodable" || attachment.decodable === false || attachment.quality === "undecodable") return "undecodable";
    if (attachment.quality === "satisfactory") return "accepted";
    if (attachment.quality === "unrelated" || attachment.quality === "unusable") return "unrelated";
    return "uncertain";
  }
  interpret(conversation: Conversation): ReportInterpretation | undefined {
    if (!conversation.issue || !conversation.location || conversation.acceptedEvidence.length === 0) return undefined;
    return { issue: conversation.issue, category: categoryFor(conversation.issue), location: copyLocation(conversation.location), primaryEvidence: conversation.acceptedEvidence.map(copyAttachment) };
  }
}

export class SimulatedReportRegistration {
  readonly adapter: FakeChannelAdapter;
  readonly store: SimulatedReportStore;
  readonly model: FakeVisionReportModel;

  constructor({ adapter, store, model }: { adapter: FakeChannelAdapter; store: SimulatedReportStore; model: FakeVisionReportModel }) {
    this.adapter = adapter;
    this.store = store;
    this.model = model;
    adapter.registerInboundHandler((message) => this.receive(message));
  }

  async receive(message: InboundMessage): Promise<void> {
    let conversation = this.store.activeConversation(message.channel, message.conversationId);
    if (!conversation || conversation.phase === "registered" || conversation.phase === "cancelled") conversation = this.store.startConversation(message);
    const persisted = this.store.persistInbound(conversation, message);
    if (!persisted) return;
    const action = actionFor(message);

    if (conversation.phase === "authentication_pending") {
      await this.#reply(message, "Your report is ready. Complete the authentication link to register it.");
      return;
    }

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
      result: attachment.decodeStatus === "undecodable" ? ("undecodable" as const) : this.model.inspect(attachment),
    }));
    for (const { attachment, result } of inspections) {
      if (result === "accepted") conversation.acceptedEvidence.push(attachment);
    }
    const rejected = inspections.find(({ result }) => result !== "accepted");
    if (!rejected) delete conversation.editing;
    if (!rejected || rejected.result === "accepted") return undefined;
    return rejected.result;
  }

  async completeAuthentication(input: { authenticationLink: string; citizenId: string }): Promise<{ report: RegisteredReport }> {
    const { authenticationLink, citizenId } = authenticationCallbackSchema.parse(input);
    const report = this.store.authenticate(authenticationLink, citizenId);
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
