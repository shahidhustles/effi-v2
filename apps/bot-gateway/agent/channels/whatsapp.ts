import { POST } from "eve/channels";
import { z } from "zod";
import { ReportAuthenticationService } from "../../src/report-authentication.js";
import { createWhatsAppChannel } from "../../src/whatsapp-channel.js";
import { matchesWebhookSecret } from "../../src/webhook-secrets.js";
import { reportStore } from "../lib/reporting.js";
import { dispatchWhatsAppTurn } from "../lib/whatsapp-dispatch.js";
import { whatsappMediaStorage, whatsappReportIngress } from "../lib/whatsapp-reporting.js";

const authDirectory = process.env.WHATSAPP_AUTH_DIR ?? ".data/whatsapp-auth";
const textPart = z.object({ type: z.literal("text"), text: z.string() });
const filePart = z.object({ type: z.literal("file"), data: z.string(), mediaType: z.string(), filename: z.string().optional() });
const dispatchBody = z.object({
  input: z.union([z.string(), z.array(z.union([textPart, filePart]))]),
  principalId: z.string().min(1),
  threadId: z.string().min(1),
});
const authenticationBody = z.object({
  authenticationLink: z.string().url(),
  citizenId: z.string().min(1),
  conversationId: z.string().min(1),
});
const runtime = await createWhatsAppChannel({
  authDirectory,
  mediaStorage: whatsappMediaStorage,
  ...(process.env.WHATSAPP_PHONE_NUMBER ? { phoneNumber: process.env.WHATSAPP_PHONE_NUMBER } : {}),
  onPairingCode: (code) => console.info(`WhatsApp pairing code: ${code}`),
  dispatch: dispatchWhatsAppTurn,
  onInbound: (message) => {
    const record = whatsappReportIngress.acceptForDispatch(message);
    return record ? whatsappReportIngress.contextFor(record) : null;
  },
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
      const input = typeof parsed.data.input === "string"
        ? parsed.data.input
        : parsed.data.input.map((part) => part.type === "text"
          ? part
          : { type: part.type, data: part.data, mediaType: part.mediaType, ...(part.filename ? { filename: part.filename } : {}) });

      await to(channel, { adapterName: "whatsapp", threadId: parsed.data.threadId }).send(input, {
        auth: {
          authenticator: "whatsapp-chat-sdk",
          principalType: "user",
          principalId: parsed.data.principalId,
          attributes: { channel: "whatsapp", conversation_id: parsed.data.threadId },
        },
      });
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
      return Response.json({ reportId: result.report.id });
    }),
  ],
} satisfies typeof runtime.channel;

export default channel;
