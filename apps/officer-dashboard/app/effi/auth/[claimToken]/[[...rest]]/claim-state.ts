export type ReportChannel = "telegram" | "whatsapp";

export type ClaimResult = {
  reportNumber: string;
  channel: ReportChannel;
  conversationId: string;
  alreadyClaimed: boolean;
};

export type ClaimFailure = {
  kind: "expired" | "invalid" | "failed";
  title: string;
  message: string;
};

export function channelName(channel: ReportChannel): "Telegram" | "WhatsApp" {
  return channel === "telegram" ? "Telegram" : "WhatsApp";
}

export function describeClaimFailure(reason: unknown): ClaimFailure {
  const message = reason instanceof Error ? reason.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("expired")) {
    return {
      kind: "expired",
      title: "This link has expired",
      message: "Return to the chat and send a new issue to start another report.",
    };
  }

  if (normalized.includes("invalid")) {
    return {
      kind: "invalid",
      title: "This link is not valid",
      message: "Return to the chat and use the latest registration link for your report.",
    };
  }

  return {
    kind: "failed",
    title: "We could not register this report",
    message: "Return to the chat and try the registration link again. Your draft is still saved.",
  };
}
