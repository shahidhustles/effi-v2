import type {
  Conversation,
  InboundMessage,
  PersistedMessage,
  SimulatedReportStore,
} from "./simulated-report-registration.js";

export type ReportIngressRecord = {
  readonly inbound: InboundMessage;
  readonly conversation: Conversation;
  readonly persisted: PersistedMessage;
};

/** Persist the normalized channel contract before an Eve model turn starts. */
export class SharedReportIngress {
  constructor(readonly store: SimulatedReportStore) {}

  accept(inbound: InboundMessage): ReportIngressRecord | undefined {
    if (this.store.hasPersistedMessage(inbound)) return undefined;
    let conversation = this.store.activeConversation(inbound.channel, inbound.conversationId);
    if (!conversation || conversation.phase === "registered" || conversation.phase === "cancelled") {
      conversation = this.store.startConversation(inbound);
    }
    const persisted = this.store.persistInbound(conversation, inbound);
    if (!persisted) return undefined;
    this.store.applyInboundFacts(conversation, persisted);
    return { inbound, conversation, persisted };
  }

  /** Return an existing record when a downstream dispatch is being retried. */
  acceptForDispatch(inbound: InboundMessage): ReportIngressRecord | undefined {
    const accepted = this.accept(inbound);
    if (accepted) return accepted;
    const conversation = this.store.activeConversation(inbound.channel, inbound.conversationId);
    const persisted = this.store.persistedMessage(inbound.channel, inbound.conversationId, inbound.id);
    return conversation && persisted ? { inbound, conversation, persisted } : undefined;
  }

  contextFor(record: ReportIngressRecord): string {
    const { inbound, persisted } = record;
    const channelName = inbound.channel === "telegram" ? "Telegram" : "WhatsApp";
    const lines = [
      `Effi has persisted this ${channelName} message before model processing.`,
      `${inbound.channel}_message_id: ${inbound.id}`,
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
