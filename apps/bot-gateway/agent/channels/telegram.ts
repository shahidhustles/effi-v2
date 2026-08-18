import {
  defaultTelegramAuth,
  telegramChannel,
  type TelegramChannelConfig,
} from "eve/channels/telegram";
import { telegramReportIngress } from "../lib/telegram-reporting.js";

const config: TelegramChannelConfig = {
  ...(process.env.TELEGRAM_BOT_USERNAME ? { botUsername: process.env.TELEGRAM_BOT_USERNAME } : {}),
  turnPolicy: "steer",
  uploadPolicy: "disabled",
  onMessage: async (ctx, message) => {
    const record = await telegramReportIngress.accept(message);
    if (!record) return null;
    if (record.conversation.phase === "authentication_pending") {
      await ctx.telegram.post("Your report is ready. Complete the authentication link to register it.");
      return null;
    }
    return {
      auth: defaultTelegramAuth(message),
      context: [telegramReportIngress.contextFor(record)],
      title: "Effi civic report registration",
    };
  },
};

export default telegramChannel(config);
