export type Channel = "telegram" | "whatsapp";
export type InboundMessage = { id: string; channel: Channel; conversationId: string; senderId: string; text?: string; receivedAt: string };
export type OutboundMessage = { channel: Channel; conversationId: string; text: string };
export type WebhookVerification = { signature: string | null; timestamp: string | null; rawBody: string };

export interface ChannelAdapter {
  verifyWebhook(input: WebhookVerification): Promise<boolean>;
  parseInbound(input: WebhookVerification): Promise<InboundMessage[]>;
  send(message: OutboundMessage): Promise<void>;
}

export const botEnvironmentKeys = ["BOT_WEBHOOK_SECRET"] as const;

export class FakeChannelAdapter implements ChannelAdapter {
  readonly sent: OutboundMessage[] = [];
  async verifyWebhook(): Promise<boolean> { return true; }
  async parseInbound(): Promise<InboundMessage[]> { return []; }
  async send(message: OutboundMessage): Promise<void> { this.sent.push(message); }
}
