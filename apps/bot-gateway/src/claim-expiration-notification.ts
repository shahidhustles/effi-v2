import type { Channel } from "./simulated-report-registration.js";

export const expiredClaimLinkReply = "Your report registration link has expired. Send a new issue to start a new report.";

type ChannelNotificationSenders = Record<Channel, (conversationId: string, text: string) => Promise<void>>;

export const sendExpiredClaimLinkNotification = async (
  notification: { channel: Channel; conversationId: string },
  senders: ChannelNotificationSenders,
): Promise<void> => {
  await senders[notification.channel](notification.conversationId, expiredClaimLinkReply);
};
