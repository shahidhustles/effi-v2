import { auth } from "@clerk/nextjs/server";

const isChannel = (value: unknown): value is "telegram" | "whatsapp" => value === "telegram" || value === "whatsapp";

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return new Response("unauthorized", { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("invalid acknowledgement", { status: 400 });
  const { claimToken, channel, conversationId } = body as Record<string, unknown>;
  if (typeof claimToken !== "string" || !isChannel(channel) || typeof conversationId !== "string") return new Response("invalid acknowledgement", { status: 400 });
  const baseUrl = process.env.EFFI_BOT_GATEWAY_URL;
  const secret = process.env.EFFI_AUTH_CALLBACK_SECRET;
  const authenticationBaseUrl = process.env.EFFI_AUTHENTICATION_BASE_URL;
  if (!baseUrl || !secret || !authenticationBaseUrl) return new Response("acknowledgement unavailable", { status: 503 });
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/effi/v1/${channel}/auth/callback`, {
    method: "POST", headers: { "content-type": "application/json", "x-effi-auth-callback-secret": secret },
    body: JSON.stringify({ authenticationLink: `${authenticationBaseUrl.replace(/\/$/, "")}/${claimToken}`, citizenId: userId, conversationId, idempotencyKey: `clerk:${claimToken}` }),
  });
  return response.ok ? new Response(null, { status: 204 }) : new Response("acknowledgement unavailable", { status: 502 });
}
