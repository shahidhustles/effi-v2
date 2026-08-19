import { createHmac } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Conversation, InboundMessage, PendingSubmission } from "./simulated-report-registration.js";

type PersistedDraft = {
  duplicate: boolean;
  draft: { phase: "gathering" | "awaiting_confirmation" | "authentication_pending" | "registered" | "cancelled"; sessionId: string };
  messages: readonly { providerMessageId: string; receivedAt: number; payload: unknown }[];
};

const resumeOrAppendInbound = makeFunctionReference<"mutation">("reporting:resumeOrAppendInbound");
const syncDraftState = makeFunctionReference<"mutation">("reporting:syncDraftState");
const createPendingSubmission = makeFunctionReference<"mutation">("reporting:createPendingSubmission");
const reserveChannelAcknowledgement = makeFunctionReference<"mutation">("reporting:reserveChannelAcknowledgement");
const recordChannelAcknowledgementOutcome = makeFunctionReference<"mutation">("reporting:recordChannelAcknowledgementOutcome");

/** An opaque, keyed scope prevents database indexes from revealing provider identities. */
export const anonymousDraftScope = (secret: string, inbound: Pick<InboundMessage, "channel" | "senderId" | "conversationId">): string =>
  createHmac("sha256", secret).update(`${inbound.channel}\u0000${inbound.senderId}\u0000${inbound.conversationId}`).digest("base64url");

export class ConvexReportStore {
  readonly #client: ConvexHttpClient;
  constructor(url: string, private readonly scopeSecret: string, private readonly serviceSecret: string) { this.#client = new ConvexHttpClient(url); }

  async persistInbound(inbound: InboundMessage): Promise<PersistedDraft> {
    return await this.#client.mutation(resumeOrAppendInbound, {
      serviceSecret: this.serviceSecret,
      scopeKey: anonymousDraftScope(this.scopeSecret, inbound),
      channel: inbound.channel,
      providerMessageId: inbound.id,
      receivedAt: Date.parse(inbound.receivedAt),
      payload: inbound,
    });
  }

  async syncConversation(conversation: Conversation): Promise<void> {
    const source = { channel: conversation.channel, senderId: conversation.senderId, conversationId: conversation.conversationId };
    await this.#client.mutation(syncDraftState, {
      serviceSecret: this.serviceSecret,
      scopeKey: anonymousDraftScope(this.scopeSecret, source),
      phase: conversation.phase,
      updatedAt: Date.now(),
      messages: conversation.messages.map((message) => ({ providerMessageId: message.id, payload: message })),
    });
  }

  async persistPendingSubmission(pending: PendingSubmission): Promise<void> {
    const source = pending.conversation;
    const claimToken = pending.authenticationLink.split("/").at(-1);
    if (!claimToken) throw new Error("Pending submission has no claim token.");
    await this.#client.mutation(createPendingSubmission, {
      serviceSecret: this.serviceSecret,
      scopeKey: anonymousDraftScope(this.scopeSecret, source), channel: source.channel, conversationId: source.conversationId,
      claimToken, expiresAt: Date.parse(pending.expiresAt), issue: pending.interpretation.issue, category: pending.interpretation.category,
      location: pending.interpretation.location,
      primaryEvidence: pending.interpretation.primaryEvidence.map((attachment) => ({ attachmentId: attachment.id, storageKey: attachment.storageKey })),
    });
  }

  async reserveAcknowledgement(input: { reportNumber: string; channel: "telegram" | "whatsapp"; conversationId: string }): Promise<{ reserved: boolean; state: "reserved" | "delivered" | "failed"; reportNumber: string }> {
    return await this.#client.mutation(reserveChannelAcknowledgement, { serviceSecret: this.serviceSecret, ...input });
  }

  async recordAcknowledgementOutcome(reportNumber: string, delivered: boolean): Promise<void> {
    await this.#client.mutation(recordChannelAcknowledgementOutcome, { serviceSecret: this.serviceSecret, reportNumber, delivered });
  }
}
