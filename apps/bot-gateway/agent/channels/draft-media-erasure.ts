import { POST, defineChannel } from "eve/channels";
import { z } from "zod";
import { sendExpiredClaimLinkNotification } from "../../src/claim-expiration-notification.js";
import { eraseAnonymousDraftMedia } from "../../src/draft-media-erasure.js";
import { matchesWebhookSecret } from "../../src/webhook-secrets.js";
import { telegramReportIngress } from "../lib/telegram-reporting.js";
import { whatsappMediaStorage } from "../lib/whatsapp-reporting.js";

const requestSchema = z.object({
  storageKeys: z.array(z.string().min(1)).max(64),
  notification: z.object({
    channel: z.enum(["telegram", "whatsapp"]),
    conversationId: z.string().min(1),
  }).optional(),
});

type WhatsAppSocket = { sendMessage(jid: string, content: { text: string }): Promise<unknown> };
const whatsappSocket = (): WhatsAppSocket | null => {
  const state = globalThis as typeof globalThis & { __effiWhatsAppState?: { socket: WhatsAppSocket | null } };
  return state.__effiWhatsAppState?.socket ?? null;
};

export default defineChannel({
  routes: [
    POST("/effi/v1/internal/erase-anonymous-draft-media", async (request) => {
      if (!matchesWebhookSecret(request.headers.get("x-effi-media-erasure-secret"), process.env.EFFI_GATEWAY_CONVEX_SECRET)) {
        return new Response("unauthorized", { status: 401 });
      }
      const parsed = requestSchema.safeParse(await request.json().catch(() => undefined));
      if (!parsed.success) return new Response("invalid media erasure request", { status: 400 });
      const telegramRemove = telegramReportIngress.adapter.storage.remove;
      const whatsappRemove = whatsappMediaStorage.remove;
      if (!telegramRemove || !whatsappRemove) return new Response("controlled media erasure is unavailable", { status: 503 });
      await eraseAnonymousDraftMedia(parsed.data.storageKeys, {
        telegram: { remove: async (storageKey) => await telegramRemove.call(telegramReportIngress.adapter.storage, storageKey) },
        whatsapp: { remove: async (storageKey) => await whatsappRemove.call(whatsappMediaStorage, storageKey) },
      });
      if (parsed.data.notification) {
        await sendExpiredClaimLinkNotification(parsed.data.notification, {
          telegram: async (conversationId, text) => await telegramReportIngress.adapter.send({ channel: "telegram", conversationId, text }),
          whatsapp: async (conversationId, text) => {
            const socket = whatsappSocket();
            if (!socket) throw new Error("WhatsApp is disconnected.");
            await socket.sendMessage(conversationId, { text });
          },
        });
      }
      return Response.json({ erased: parsed.data.storageKeys.length });
    }),
  ],
});
