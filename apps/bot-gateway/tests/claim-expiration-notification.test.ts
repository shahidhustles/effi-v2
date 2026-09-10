import { describe, expect, it, vi } from "vitest";
import { expiredClaimLinkReply, sendExpiredClaimLinkNotification } from "../src/claim-expiration-notification.js";

describe("claim expiration notification", () => {
  it.each(["telegram", "whatsapp"] as const)("notifies the originating %s conversation", async (channel) => {
    const telegram = vi.fn(async () => undefined);
    const whatsapp = vi.fn(async () => undefined);

    await sendExpiredClaimLinkNotification({ channel, conversationId: `${channel}-conversation` }, { telegram, whatsapp });

    expect(channel === "telegram" ? telegram : whatsapp).toHaveBeenCalledWith(
      `${channel}-conversation`,
      expiredClaimLinkReply,
    );
    expect(channel === "telegram" ? whatsapp : telegram).not.toHaveBeenCalled();
  });
});
