import { createHmac } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Conversation, InboundMessage } from "./simulated-report-registration.js";

type PersistedDraft = {
  duplicate: boolean;
  draft: { phase: "gathering" | "awaiting_confirmation" | "authentication_pending" | "registered" | "cancelled"; sessionId: string };
  messages: readonly { providerMessageId: string; receivedAt: number; payload: unknown }[];
};

const resumeOrAppendInbound = makeFunctionReference<"mutation">("reporting:resumeOrAppendInbound");
const syncDraftState = makeFunctionReference<"mutation">("reporting:syncDraftState");

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
}
