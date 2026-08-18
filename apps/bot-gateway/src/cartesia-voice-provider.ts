import type { VoiceAudio, VoiceFetch, VoiceSynthesisInput } from "./voice.js";

export type CartesiaVoiceProviderOptions = {
  apiKey: string;
  voiceId: string;
  fetch?: VoiceFetch;
  baseUrl?: string;
};

/** Minimal Cartesia Sonic 3 adapter used only after Bulbul synthesis fails. */
export class CartesiaVoiceProvider {
  readonly #apiKey: string;
  readonly #voiceId: string;
  readonly #fetch: VoiceFetch;
  readonly #baseUrl: string;

  constructor(options: CartesiaVoiceProviderOptions) {
    this.#apiKey = options.apiKey;
    this.#voiceId = options.voiceId;
    this.#fetch = options.fetch ?? fetch;
    this.#baseUrl = options.baseUrl ?? "https://api.cartesia.ai";
  }

  async synthesize(input: VoiceSynthesisInput): Promise<VoiceAudio> {
    if (!this.#apiKey || !this.#voiceId) throw new Error("Cartesia voice fallback is not configured.");
    const response = await this.#fetch(`${this.#baseUrl}/tts/bytes`, {
      method: "POST",
      headers: {
        "Cartesia-Version": "2024-11-13",
        "X-API-Key": this.#apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        transcript: input.text,
        model_id: "sonic-3",
        voice: { mode: "id", id: this.#voiceId },
        language: input.languageCode.split("-", 1)[0],
        output_format: { container: "mp3", sample_rate: 44_100, bit_rate: 128_000 },
      }),
    });
    if (!response.ok) throw new Error(`Cartesia text-to-speech failed with HTTP ${response.status}.`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength === 0) throw new Error("Cartesia text-to-speech returned empty audio.");
    return { data, mediaType: "audio/mpeg", languageCode: input.languageCode, fileName: "effi-response.mp3" };
  }
}

export const cartesiaVoiceProvider = new CartesiaVoiceProvider({
  apiKey: process.env.CARTESIA_API_KEY ?? "",
  voiceId: process.env.CARTESIA_VOICE_ID ?? "",
});
