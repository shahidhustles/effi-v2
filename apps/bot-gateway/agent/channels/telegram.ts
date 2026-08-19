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
import { failureContext } from "../../src/failure-context.js";
import { authenticationPendingReply, isAuthenticationPending } from "../../src/authentication-pending.js";

const telegramApiBaseUrl = process.env.TELEGRAM_API_BASE_URL;

const telegramConversationFor = (telegram: TelegramHandle): string => (
  telegram.messageThreadId === undefined
    ? telegram.chatId
    : `${telegram.chatId}:${telegram.messageThreadId}`
);

const retryInstructionFor = (message: Parameters<NonNullable<TelegramChannelConfig["onMessage"]>>[1]): string => {
  const hasVoice = Boolean(message.raw.voice || message.raw.audio);
  if (hasVoice) return "I received your voice note, but could not process it. Please retry only the voice note.";
  const hasPhoto = message.attachments.some((attachment) => attachment.kind === "photo" || attachment.mediaType?.startsWith("image/"));
  if (hasPhoto) return "I received your message, but could not process the photo. Please retry only the photo.";
  return "I received your message, but could not process it. Please retry only this message.";
};

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
    const conversationId = telegramConversationFor(ctx.telegram);
    if (isAuthenticationPending(telegramReportIngress.store, "telegram", conversationId)) {
      await sendTelegramVoiceReply(ctx.telegram, authenticationPendingReply);
      return null;
    }
    let record;
    try {
      record = await telegramReportIngress.accept(message);
    } catch (error) {
      console.error("Effi Telegram turn failed", { messageId: message.messageId, ...failureContext("inbound processing or delivery", error) });
      await sendTelegramVoiceReply(ctx.telegram, retryInstructionFor(message));
      return null;
    }
    if (!record) {
      if (isAuthenticationPending(telegramReportIngress.store, "telegram", conversationId)) {
        await sendTelegramVoiceReply(ctx.telegram, authenticationPendingReply);
      }
      return null;
    }
    if (record.persisted.voice && record.persisted.voice.status !== "transcribed") {
      await sendTelegramVoiceRecovery(ctx.telegram);
      return null;
    }
    if (record.conversation.phase === "authentication_pending") {
      await sendTelegramVoiceReply(ctx.telegram, authenticationPendingReply);
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
