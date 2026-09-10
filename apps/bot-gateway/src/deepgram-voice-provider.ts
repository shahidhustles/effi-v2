import { DeepgramClient } from "@deepgram/sdk";
import {
  detectTextLanguage,
  normalizeLanguageCode,
  type VoiceInput,
  type VoiceTranscription,
} from "./voice.js";

type DeepgramTranscribeFile = (
  audio: { data: Buffer; contentType: string },
  options: { model: "nova-3"; detect_language: true; smart_format: true; punctuate: true },
) => Promise<unknown>;

export type DeepgramVoiceProviderOptions = {
  apiKey: string;
  transcribeFile?: DeepgramTranscribeFile;
};

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | undefined => (
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined
);

const firstItem = (value: unknown): unknown => Array.isArray(value) ? value[0] : undefined;

/** Deepgram Nova-3 transcription for Telegram and WhatsApp voice notes. */
export class DeepgramVoiceProvider {
  readonly #apiKey: string;
  readonly #transcribeFile: DeepgramTranscribeFile | undefined;

  constructor(options: DeepgramVoiceProviderOptions) {
    this.#apiKey = options.apiKey;
    this.#transcribeFile = options.transcribeFile;
  }

  async transcribe(input: VoiceInput): Promise<VoiceTranscription> {
    if (!this.#apiKey) throw new Error("Deepgram API key is not configured.");
    const transcribeFile = this.#transcribeFile ?? ((audio, options) => {
      const client = new DeepgramClient({ apiKey: this.#apiKey });
      return client.listen.v1.media.transcribeFile(audio, options);
    });
    const response = asRecord(await transcribeFile(
      { data: Buffer.from(input.data), contentType: input.mediaType },
      { model: "nova-3", detect_language: true, smart_format: true, punctuate: true },
    ));
    const channel = asRecord(firstItem(asRecord(response?.results)?.channels));
    const alternative = asRecord(firstItem(channel?.alternatives));
    const transcript = typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
    if (!transcript) return { status: "unintelligible" };
    const languageCode = normalizeLanguageCode(channel?.detected_language) ?? detectTextLanguage(transcript);
    return { status: "transcribed", transcript, languageCode };
  }
}

export const deepgramVoiceProvider = new DeepgramVoiceProvider({
  apiKey: process.env.DEEPGRAM_API_KEY ?? "",
});
