import { POST } from "eve/channels";
import { z } from "zod";
import { ReportAuthenticationService } from "../../src/report-authentication.js";
import { createWhatsAppChannel, type WhatsAppInboundResult } from "../../src/whatsapp-channel.js";
import { FileMessageDedupe } from "../../src/whatsapp-persistence.js";
import { matchesWebhookSecret } from "../../src/webhook-secrets.js";
import { join } from "node:path";
import { durableReportStore, reportStore } from "../lib/reporting.js";
import { dispatchWhatsAppTurn } from "../lib/whatsapp-dispatch.js";
import { whatsappMediaStorage, whatsappReportIngress } from "../lib/whatsapp-reporting.js";
import { isReportReadyForReview } from "../../src/voice.js";
import { reliableVoiceProvider } from "../../src/reliable-voice-provider.js";

const authDirectory = process.env.WHATSAPP_AUTH_DIR ?? ".data/whatsapp-auth";
const textPart = z.object({ type: z.literal("text"), text: z.string() });
const filePart = z.object({ type: z.literal("file"), data: z.string(), mediaType: z.string(), filename: z.string().optional() });
const dispatchBody = z.object({
  input: z.union([z.string(), z.array(z.union([textPart, filePart]))]),
  messageId: z.string().min(1),
  principalId: z.string().min(1),
  threadId: z.string().min(1),
});
const eveDispatchDedupe = new FileMessageDedupe(join(authDirectory, "eve-dispatch-ids.json"));
const authenticationBody = z.object({
  authenticationLink: z.string().url(),
  citizenId: z.string().min(1),
  conversationId: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});
const runtime = await createWhatsAppChannel({
  authDirectory,
  mediaStorage: whatsappMediaStorage,
  voiceProvider: reliableVoiceProvider,
  ...(process.env.WHATSAPP_PHONE_NUMBER ? { phoneNumber: process.env.WHATSAPP_PHONE_NUMBER } : {}),
  onPairingCode: (code) => console.info(`WhatsApp pairing code: ${code}`),
  dispatch: dispatchWhatsAppTurn,
  onInbound: async (message) => {
    const record = durableReportStore
      ? await whatsappReportIngress.acceptDurably(message, durableReportStore)
      : whatsappReportIngress.acceptForDispatch(message);
    if (!record) return null;
    if (record.conversation.phase === "authentication_pending") {
      return {
        lockedReply: "Your report is ready. Complete the authentication link to register it.",
      } satisfies WhatsAppInboundResult;
    }
    return whatsappReportIngress.contextFor(record);
  },
  onVoiceTranscribed: async (message) => {
    const record = whatsappReportIngress.acceptForDispatch(message);
    if (!record) return null;
    const enriched = durableReportStore
      ? await whatsappReportIngress.enrichVoiceDurably(record, message, durableReportStore)
      : whatsappReportIngress.enrichVoice(record, message);
    return whatsappReportIngress.contextFor(enriched);
  },
  isAuthenticationPending: (message) => reportStore.activeConversation("whatsapp", message.conversationId)?.phase === "authentication_pending",
  onAuthenticationPending: async (thread) => {
    await thread.post({ markdown: "Your report is ready. Complete the authentication link to register it." });
  },
  isReportReadyForReview: (conversationId) => isReportReadyForReview(reportStore.activeConversation("whatsapp", conversationId)),
});

export const { bot, send, whatsapp, disconnect } = runtime;
export const whatsappAuthenticationService = new ReportAuthenticationService(
  "whatsapp",
  reportStore,
  async (conversationId, text) => {
    await whatsapp.postMessage(conversationId, text);
  },
);

export const channel = {
  ...runtime.channel,
  routes: [
    ...runtime.channel.routes,
    POST("/effi/v1/whatsapp/socket-inbound", async (request, { to }) => {
      if (!matchesWebhookSecret(
        request.headers.get("x-effi-internal-dispatch-secret"),
        process.env.EFFI_INTERNAL_DISPATCH_SECRET,
      )) return new Response("unauthorized", { status: 401 });

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("invalid WhatsApp dispatch", { status: 400 });
      }
      const parsed = dispatchBody.safeParse(body);
      if (!parsed.success) return new Response("invalid WhatsApp dispatch", { status: 400 });
      const claimed = await eveDispatchDedupe.claim(parsed.data.messageId);
      if (!claimed) return Response.json({ accepted: true, duplicate: true });
      const input = typeof parsed.data.input === "string"
        ? parsed.data.input
        : parsed.data.input.map((part) => part.type === "text"
          ? part
          : { type: part.type, data: part.data, mediaType: part.mediaType, ...(part.filename ? { filename: part.filename } : {}) });

      try {
        await to(channel, { adapterName: "whatsapp", threadId: parsed.data.threadId }).send(input, {
          auth: {
            authenticator: "whatsapp-chat-sdk",
            principalType: "user",
            principalId: parsed.data.principalId,
            attributes: { channel: "whatsapp", conversation_id: parsed.data.threadId },
          },
        });
        await eveDispatchDedupe.complete(parsed.data.messageId);
      } catch (error) {
        await eveDispatchDedupe.release(parsed.data.messageId);
        throw error;
      }
      return Response.json({ accepted: true });
    }),
    POST("/effi/v1/whatsapp/auth/callback", async (request) => {
      if (!matchesWebhookSecret(request.headers.get("x-effi-auth-callback-secret"), process.env.EFFI_AUTH_CALLBACK_SECRET)) {
        return new Response("unauthorized", { status: 401 });
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("invalid authentication callback", { status: 400 });
      }
      const parsed = authenticationBody.safeParse(body);
      if (!parsed.success) return new Response("invalid authentication callback", { status: 400 });
      const result = await whatsappAuthenticationService.complete(parsed.data);
      const conversation = reportStore.activeConversation("whatsapp", parsed.data.conversationId);
      if (conversation && durableReportStore) await durableReportStore.syncConversation(conversation);
      return Response.json({ reportId: result.report.id });
    }),
  ],
} satisfies typeof runtime.channel;

export default channel;
