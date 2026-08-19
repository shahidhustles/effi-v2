import { z } from "zod";
import { ReportAuthenticationService, type DurableAcknowledgementStore, type ReportChannel } from "./report-authentication.js";
import { matchesWebhookSecret } from "./webhook-secrets.js";

const callbackBody = z.object({ reportNumber: z.string().min(1), conversationId: z.string().min(1) });

export const createChannelAcknowledgementCallback = (input: {
  channel: ReportChannel;
  callbackSecret: () => string | undefined;
  store: () => DurableAcknowledgementStore | undefined;
  send: (conversationId: string, text: string) => Promise<void>;
}) => async (request: Request): Promise<Response> => {
  if (!matchesWebhookSecret(request.headers.get("x-effi-auth-callback-secret"), input.callbackSecret())) return new Response("unauthorized", { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = callbackBody.safeParse(body);
  if (!parsed.success) return new Response("invalid authentication callback", { status: 400 });
  const store = input.store();
  if (!store) return new Response("durable reporting unavailable", { status: 503 });
  try {
    const result = await new ReportAuthenticationService(input.channel, store, input.send).complete(parsed.data);
    return Response.json({ reportId: result.reportNumber, acknowledgementState: result.acknowledgementState });
  } catch {
    return new Response("acknowledgement delivery failed", { status: 502 });
  }
};
