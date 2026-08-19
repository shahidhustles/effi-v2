import { POST, defineChannel } from "eve/channels";
import { z } from "zod";
import { matchesWebhookSecret } from "../../src/webhook-secrets.js";
import { telegramAuthenticationService } from "../lib/telegram-reporting.js";
import { durableReportStore, reportStore } from "../lib/reporting.js";

const callbackBody = z.object({
  authenticationLink: z.string().url(),
  citizenId: z.string().min(1),
  conversationId: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

const isValidCallbackSecret = (received: string | null): boolean => {
  return matchesWebhookSecret(received, process.env.EFFI_AUTH_CALLBACK_SECRET);
};

export default defineChannel({
  routes: [
    POST("/effi/v1/telegram/auth/callback", async (request) => {
      if (!isValidCallbackSecret(request.headers.get("x-effi-auth-callback-secret"))) {
        return new Response("unauthorized", { status: 401 });
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("invalid authentication callback", { status: 400 });
      }
      const parsed = callbackBody.safeParse(body);
      if (!parsed.success) return new Response("invalid authentication callback", { status: 400 });

      const result = await telegramAuthenticationService.complete(parsed.data);
      const conversation = reportStore.activeConversation("telegram", parsed.data.conversationId);
      if (conversation && durableReportStore) await durableReportStore.syncConversation(conversation);
      return Response.json({ reportId: result.report.id });
    }),
  ],
});
