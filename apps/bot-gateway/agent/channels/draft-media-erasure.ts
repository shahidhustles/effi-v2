import { POST, defineChannel } from "eve/channels";
import { z } from "zod";
import { eraseAnonymousDraftMedia } from "../../src/draft-media-erasure.js";
import { matchesWebhookSecret } from "../../src/webhook-secrets.js";
import { telegramReportIngress } from "../lib/telegram-reporting.js";
import { whatsappMediaStorage } from "../lib/whatsapp-reporting.js";

const requestSchema = z.object({ storageKeys: z.array(z.string().min(1)).max(64) });

export default defineChannel({
  routes: [
    POST("/effi/v1/internal/erase-anonymous-draft-media", async (request) => {
      if (!matchesWebhookSecret(request.headers.get("x-effi-media-erasure-secret"), process.env.EFFI_GATEWAY_MEDIA_ERASURE_SECRET)) {
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
      return Response.json({ erased: parsed.data.storageKeys.length });
    }),
  ],
});
