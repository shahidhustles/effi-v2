import { gateway } from "@ai-sdk/gateway";
import { transcribe } from "ai";
import {
  detectTextLanguage,
  normalizeLanguageCode,
  type VoiceInput,
  type VoiceTranscription,
} from "./voice.js";

type GatewayTranscription = (input: { model: string; audio: Uint8Array }) => Promise<{
  text: string;
  language?: string | undefined;
}>;

export type AiGatewayVoiceProviderOptions = {
  model: string;
  transcribe?: GatewayTranscription;
};

/** Vercel AI Gateway transcription (OpenAI Whisper) with language detection for voice notes. */
export class AiGatewayVoiceProvider {
  readonly #model: string;
  readonly #transcribe: GatewayTranscription;

  constructor(options: AiGatewayVoiceProviderOptions) {
    this.#model = options.model;
    this.#transcribe = options.transcribe ?? (async ({ model, audio }) => {
      const result = await transcribe({ model: gateway.transcription(model), audio });
      return { text: result.text, language: result.language };
    });
  }

  async transcribe(input: VoiceInput): Promise<VoiceTranscription> {
    const result = await this.#transcribe({ model: this.#model, audio: input.data });
    const transcript = result.text.trim();
    if (!transcript) return { status: "unintelligible" };
    const languageCode = normalizeLanguageCode(result.language) ?? detectTextLanguage(transcript);
    return { status: "transcribed", transcript, languageCode };
  }
}

export const aiGatewayVoiceProvider = new AiGatewayVoiceProvider({
  model: process.env.AI_GATEWAY_TRANSCRIPTION_MODEL ?? "openai/whisper-1",
});
