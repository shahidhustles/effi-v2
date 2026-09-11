import { describe, expect, it } from "vitest";
import { channelName, describeClaimFailure } from "./claim-state";

describe("claim state presentation", () => {
  it("uses the originating channel name", () => {
    expect(channelName("telegram")).toBe("Telegram");
    expect(channelName("whatsapp")).toBe("WhatsApp");
  });

  it("turns expired links into a recoverable citizen action", () => {
    expect(describeClaimFailure(new Error("This registration link has expired."))).toEqual({
      kind: "expired",
      title: "This link has expired",
      message: "Return to the chat and send a new issue to start another report.",
    });
  });

  it("does not expose unexpected backend errors", () => {
    expect(describeClaimFailure(new Error("internal database detail"))).toEqual({
      kind: "failed",
      title: "We could not register this report",
      message: "Return to the chat and try the registration link again. Your draft is still saved.",
    });
  });
});
