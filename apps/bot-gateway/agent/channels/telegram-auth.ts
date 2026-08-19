import { POST, defineChannel } from "eve/channels";
import { createChannelAcknowledgementCallback } from "../../src/channel-auth-callback.js";
import { durableReportStore } from "../lib/reporting.js";
import { telegramReportIngress } from "../lib/telegram-reporting.js";

const acknowledgeTelegram = createChannelAcknowledgementCallback({
  channel: "telegram", callbackSecret: () => process.env.EFFI_AUTH_CALLBACK_SECRET, store: () => durableReportStore,
  send: async (conversationId, text) => await telegramReportIngress.adapter.send({ channel: "telegram", conversationId, text }),
});

export default defineChannel({
  routes: [
    POST("/effi/v1/telegram/auth/callback", async (request) => {
      return await acknowledgeTelegram(request);
    }),
  ],
});
