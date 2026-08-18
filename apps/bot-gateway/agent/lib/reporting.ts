import { randomBytes } from "node:crypto";
import type { ToolContext } from "eve/tools";
import { SharedReportIngress } from "../../src/report-ingress.js";
import { SimulatedReportStore, type Channel } from "../../src/simulated-report-registration.js";

const authenticationBaseUrl = process.env.EFFI_AUTHENTICATION_BASE_URL ?? "http://localhost:3000/effi/auth";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export type ReportConversation = { channel: Channel; conversationId: string };

export const reportConversationFromContext = (ctx: ToolContext): ReportConversation => {
  const auth = ctx.session.auth.current;
  const attributes: unknown = auth?.attributes;
  if (!auth || !isRecord(attributes)) throw new Error("This reporting tool requires a supported channel conversation.");

  if (auth.authenticator === "telegram-webhook" && typeof attributes.chat_id === "string") {
    const threadId = typeof attributes.message_thread_id === "string" ? attributes.message_thread_id : undefined;
    return { channel: "telegram", conversationId: threadId ? `${attributes.chat_id}:${threadId}` : attributes.chat_id };
  }
  if (auth.authenticator === "whatsapp-chat-sdk" && typeof attributes.conversation_id === "string") {
    return { channel: "whatsapp", conversationId: attributes.conversation_id };
  }
  throw new Error("This reporting tool requires a Telegram or WhatsApp conversation.");
};

export const reportStore = new SimulatedReportStore(() => new Date().toISOString(), {
  authenticationBaseUrl,
  tokenFactory: () => randomBytes(24).toString("base64url"),
});

export const reportIngress = new SharedReportIngress(reportStore);
