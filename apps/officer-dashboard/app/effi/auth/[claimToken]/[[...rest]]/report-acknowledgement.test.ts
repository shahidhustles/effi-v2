import { afterEach, describe, expect, it, vi } from "vitest";
import { requestReportAcknowledgement } from "./report-acknowledgement";

describe("report acknowledgement request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates the callback with the current Clerk session token", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("current-session-token");
    vi.stubGlobal("fetch", fetchMock);

    await requestReportAcknowledgement(
      {
        reportNumber: "RPT-whatsapp-1",
        channel: "whatsapp",
        conversationId: "conversation-1",
      },
      getToken,
    );

    expect(getToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/effi/report-acknowledgement",
      expect.objectContaining({
        headers: {
          authorization: "Bearer current-session-token",
          "content-type": "application/json",
        },
      }),
    );
  });

  it("does not call the callback when Clerk cannot provide a session token", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestReportAcknowledgement(
        {
          reportNumber: "RPT-whatsapp-1",
          channel: "whatsapp",
          conversationId: "conversation-1",
        },
        getToken,
      ),
    ).rejects.toThrow("The Clerk session token is unavailable.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
