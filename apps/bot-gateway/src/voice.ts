import type { Channel, InboundAttachment, InboundMessage, InboundVoice } from "./simulated-report-registration.js";

export type VoiceFetch = typeof fetch;
export type VoiceModality = "text" | "voice";
export type VoiceTranscriptionStatus = "transcribed" | "unintelligible" | "language_unknown" | "failed";

export type VoiceInput = {
  data: Uint8Array;
  mediaType: string;
  fileName?: string;
};

export type VoiceTranscription = {
  status: VoiceTranscriptionStatus;
  transcript?: string;
  languageCode?: string;
};

export type VoiceSynthesisInput = { text: string; languageCode: string };

export type VoiceAudio = {
  data: Buffer;
  mediaType: string;
  languageCode: string;
  fileName?: string;
};

export type StagedVoiceInput = {
  attachment: InboundAttachment;
  data: Uint8Array;
  fileName?: string;
};

export const pendingVoiceMessage = (message: InboundMessage, attachment: InboundAttachment): InboundMessage => ({
  ...message,
  voice: {
    attachmentId: attachment.id,
    mediaType: attachment.mediaType,
    platformReference: attachment.platformReference ?? attachment.platformUrl,
    storageKey: attachment.storageKey ?? `effi/${message.channel}/${message.conversationId}/${attachment.id}`,
    status: "pending",
  },
});

export interface VoiceProvider {
  transcribe(input: VoiceInput): Promise<VoiceTranscription>;
  synthesize(input: VoiceSynthesisInput): Promise<VoiceAudio>;
}

const transientError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:408|425|429|500|502|503|504)\b|timeout|temporar|network|unavailable|rate.limit|reset/iu.test(message);
};

/** Retry a transport/provider operation once when its failure is transient. */
export const retryTransientOperation = async <Result>(operation: () => Promise<Result>): Promise<Result> => {
  try {
    return await operation();
  } catch (error) {
    if (!transientError(error)) throw error;
    return operation();
  }
};

/** Keeps transcription on its configured provider and uses the second provider only for speech output. */
export const withVoiceSynthesisFallback = (primary: VoiceProvider, fallback: Pick<VoiceProvider, "synthesize">): VoiceProvider => ({
  transcribe: (input) => retryTransientOperation(() => primary.transcribe(input)),
  async synthesize(input) {
    try {
      return await retryTransientOperation(() => primary.synthesize(input));
    } catch {
      return retryTransientOperation(() => fallback.synthesize(input));
    }
  },
});

/** Add a provider transcription to the already-staged inbound voice message. */
export const transcribeInboundVoice = async (
  message: InboundMessage,
  staged: StagedVoiceInput,
  provider: VoiceProvider | undefined,
): Promise<InboundMessage> => {
  let transcription: VoiceTranscription;
  try {
    transcription = provider
      ? await provider.transcribe({ data: staged.data, mediaType: staged.attachment.mediaType, ...(staged.fileName ? { fileName: staged.fileName } : {}) })
      : { status: "failed" };
  } catch {
    transcription = { status: "failed" };
  }

  const voice: InboundVoice = {
    attachmentId: staged.attachment.id,
    mediaType: staged.attachment.mediaType,
    platformReference: staged.attachment.platformReference ?? staged.attachment.platformUrl,
    storageKey: staged.attachment.storageKey ?? `effi/${message.channel}/${message.conversationId}/${staged.attachment.id}`,
    status: transcription.status,
    ...(transcription.languageCode ? { languageCode: transcription.languageCode } : {}),
  };
  return {
    ...message,
    voice,
    ...(transcription.status === "transcribed" && transcription.transcript
      ? { voiceTranscript: transcription.transcript }
      : {}),
  };
};

const languageCodeAliases: Readonly<Record<string, string>> = {
  as: "as-IN",
  bn: "bn-IN",
  brx: "brx-IN",
  en: "en-IN",
  gu: "gu-IN",
  hi: "hi-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  od: "od-IN",
  or: "od-IN",
  pa: "pa-IN",
  ta: "ta-IN",
  te: "te-IN",
  ur: "ur-IN",
};

export const normalizeLanguageCode = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  const alias = languageCodeAliases[normalized.toLowerCase()];
  if (alias) return alias;
  const regionalCode = /^([a-z]{2,3})-([a-z]{2})$/iu.exec(normalized);
  if (regionalCode?.[1] && regionalCode[2]) return `${regionalCode[1].toLowerCase()}-${regionalCode[2].toUpperCase()}`;
  return undefined;
};

export const detectTextLanguage = (text: string): string => {
  if (/[؀-ۿ]/u.test(text)) return "ur-IN";
  if (/[ৰৱ]/u.test(text)) return "as-IN";
  if (/[ळऴऍॲ]/u.test(text)) return "mr-IN";
  if (/[ऀ-ॿ]/u.test(text)) return "hi-IN";
  if (/[ঀ-৿]/u.test(text)) return "bn-IN";
  if (/[઀-૿]/u.test(text)) return "gu-IN";
  if (/[଀-୿]/u.test(text)) return "od-IN";
  if (/[஀-௿]/u.test(text)) return "ta-IN";
  if (/[ఀ-౿]/u.test(text)) return "te-IN";
  if (/[ಀ-೿]/u.test(text)) return "kn-IN";
  if (/[ഀ-ൿ]/u.test(text)) return "ml-IN";
  if (/[਀-੿]/u.test(text)) return "pa-IN";
  return "en-IN";
};

export const languageForInput = (input: {
  text?: string;
  voiceTranscript?: string;
  languageCode?: string;
}): string => normalizeLanguageCode(input.languageCode) ?? detectTextLanguage(input.voiceTranscript ?? input.text ?? "");

export const modalityForInput = (input: { inputModality?: VoiceModality; voiceTranscript?: string }): VoiceModality =>
  input.inputModality ?? (input.voiceTranscript !== undefined ? "voice" : "text");

export type VoiceResponsePreference = {
  modality: VoiceModality;
  languageCode: string;
};

/** Holds the latest turn's language and modality for channel-specific delivery. */
export class VoiceConversationPreferences {
  #preferences = new Map<string, VoiceResponsePreference>();

  remember(input: {
    channel: Channel;
    conversationId: string;
    text?: string;
    voiceTranscript?: string;
    inputModality?: VoiceModality;
    languageCode?: string;
  }): VoiceResponsePreference {
    const preference = {
      modality: modalityForInput(input),
      languageCode: languageForInput(input),
    } satisfies VoiceResponsePreference;
    this.#preferences.set(`${input.channel}:${input.conversationId}`, preference);
    return preference;
  }

  get(channel: Channel, conversationId: string): VoiceResponsePreference | undefined {
    return this.#preferences.get(`${channel}:${conversationId}`);
  }
}

export const voicePreferences = new VoiceConversationPreferences();

export const voiceRecoveryText = "मुझे आपकी बात समझ नहीं आई। कृपया हिंदी में फिर से एक छोटा वॉइस नोट भेजें।";

export const isReportReviewMessage = (text: string): boolean => {
  const normalized = text.toLocaleLowerCase();
  return /\breview(?: your)? report\b|\bcomplete interpretation\b|\breply\s+(confirm|edit)\b/iu.test(normalized) ||
    /समीक्षा|अंतिम व्याख्या|पुष्टि करें|कन्फर्म करें/iu.test(text);
};

export const synthesizeVoiceOrUndefined = async (
  provider: VoiceProvider,
  input: VoiceSynthesisInput,
): Promise<VoiceAudio | undefined> => provider.synthesize(input).catch(() => undefined);

export const isReportReadyForReview = (conversation: {
  phase: string;
  issue?: string;
  location?: unknown;
  acceptedEvidence: readonly unknown[];
} | undefined): boolean => Boolean(
  conversation &&
  (conversation.phase === "gathering" || conversation.phase === "awaiting_confirmation") &&
  conversation.issue?.trim() &&
  conversation.location &&
  conversation.acceptedEvidence.length > 0,
);
