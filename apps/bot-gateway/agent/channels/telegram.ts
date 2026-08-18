import {
  defaultTelegramAuth,
  telegramChannel,
  type TelegramHandle,
  type TelegramChannelConfig,
} from "eve/channels/telegram";
import { telegramReportIngress } from "../lib/telegram-reporting.js";
import {
  isReportReviewMessage,
  isReportReadyForReview,
  synthesizeVoiceOrUndefined,
  voiceRecoveryText,
  voicePreferences,
} from "../../src/voice.js";
import { sendTelegramVoice } from "../../src/telegram-voice-delivery.js";

const telegramApiBaseUrl = process.env.TELEGRAM_API_BASE_URL;

const telegramConversationFor = (telegram: TelegramHandle): string => (
  telegram.messageThreadId === undefined
    ? telegram.chatId
    : `${telegram.chatId}:${telegram.messageThreadId}`
);

const sendTelegramVoiceReply = async (telegram: TelegramHandle, text: string): Promise<void> => {
  const preference = voicePreferences.get("telegram", telegramConversationFor(telegram));
  if (!preference || preference.modality === "text") {
    await telegram.post(text);
    return;
  }

  const isFinalInterpretation = isReportReadyForReview(
    telegramReportIngress.store.activeConversation("telegram", telegramConversationFor(telegram)),
  ) || isReportReviewMessage(text);
  const audio = await synthesizeVoiceOrUndefined(telegramReportIngress.voiceProvider, {
    text,
    languageCode: preference.languageCode,
  });
  if (!audio) {
    await telegram.post(text);
    return;
  }

  if (isFinalInterpretation) await telegram.post(text);
  try {
    await sendTelegramVoice({
      botToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
      ...(telegramApiBaseUrl ? { apiBaseUrl: telegramApiBaseUrl } : {}),
      chatId: telegram.chatId,
      ...(telegram.messageThreadId === undefined ? {} : { messageThreadId: telegram.messageThreadId }),
      audio,
    });
  } catch {
    if (!isFinalInterpretation) await telegram.post(text);
  }
};

const sendTelegramVoiceRecovery = async (telegram: TelegramHandle): Promise<void> => {
  const audio = await synthesizeVoiceOrUndefined(telegramReportIngress.voiceProvider, { text: voiceRecoveryText, languageCode: "hi-IN" });
  if (!audio) {
    await telegram.post(voiceRecoveryText);
    return;
  }
  try {
    await sendTelegramVoice({
      botToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
      ...(telegramApiBaseUrl ? { apiBaseUrl: telegramApiBaseUrl } : {}),
      chatId: telegram.chatId,
      ...(telegram.messageThreadId === undefined ? {} : { messageThreadId: telegram.messageThreadId }),
      audio,
    });
  } catch {
    await telegram.post(voiceRecoveryText);
  }
};

const config: TelegramChannelConfig = {
  ...(process.env.TELEGRAM_BOT_USERNAME ? { botUsername: process.env.TELEGRAM_BOT_USERNAME } : {}),
  turnPolicy: "steer",
  uploadPolicy: "disabled",
  events: {
    "message.completed": async (eventData, channel) => {
      if (!eventData.message || eventData.finishReason === "tool-calls") return;
      await sendTelegramVoiceReply(channel.telegram, eventData.message);
    },
  },
  onMessage: async (ctx, message) => {
    const record = await telegramReportIngress.accept(message);
    if (!record) return null;
    if (record.persisted.voice && record.persisted.voice.status !== "transcribed") {
      await sendTelegramVoiceRecovery(ctx.telegram);
      return null;
    }
    if (record.conversation.phase === "authentication_pending") {
      await sendTelegramVoiceReply(ctx.telegram, "Your report is ready. Complete the authentication link to register it.");
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
