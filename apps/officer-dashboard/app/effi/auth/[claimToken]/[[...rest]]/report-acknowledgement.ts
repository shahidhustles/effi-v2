import type { ClaimResult } from "./claim-state";

type GetToken = () => Promise<string | null>;
type ReportAcknowledgement = Pick<ClaimResult, "channel" | "conversationId" | "reportNumber">;

export async function requestReportAcknowledgement(
  result: ReportAcknowledgement,
  getToken: GetToken,
  signal?: AbortSignal,
): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error("The Clerk session token is unavailable.");

  return await fetch("/api/effi/report-acknowledgement", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      reportNumber: result.reportNumber,
      channel: result.channel,
      conversationId: result.conversationId,
    }),
    signal: signal ?? null,
  });
}
