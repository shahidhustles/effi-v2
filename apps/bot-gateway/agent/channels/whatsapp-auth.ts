import { POST, defineChannel } from "eve/channels";
import { z } from "zod";
import { matchesWebhookSecret } from "../../src/webhook-secrets.js";
import { whatsappAuthenticationService } from "./whatsapp.js";

const callbackBody = z.object({
  authenticationLink: z.string().url(),
  citizenId: z.string().min(1),
  conversationId: z.string().min(1),
});

export default defineChannel({
  routes: [
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
      const parsed = callbackBody.safeParse(body);
      if (!parsed.success) return new Response("invalid authentication callback", { status: 400 });

      const result = await whatsappAuthenticationService.complete(parsed.data);
      return Response.json({ reportId: result.report.id });
    }),
  ],
});
