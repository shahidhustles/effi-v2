import { Cartesia } from "@cartesia/cartesia-js";
import type { VoiceAudio, VoiceSynthesisInput } from "./voice.js";

type CartesiaGenerate = (input: {
  model_id: "sonic-3.6";
  transcript: string;
  voice: string;
  language: string;
  output_format: { container: "mp3"; sample_rate: 44_100; bit_rate: 128_000 };
}) => Promise<Response>;

export type CartesiaVoiceProviderOptions = {
  apiKey: string;
  voiceId: string;
  generate?: CartesiaGenerate;
};

/** Cartesia Sonic 3.6 speech synthesis for Telegram and WhatsApp replies. */
export class CartesiaVoiceProvider {
  readonly #apiKey: string;
  readonly #voiceId: string;
  readonly #generate: CartesiaGenerate | undefined;

  constructor(options: CartesiaVoiceProviderOptions) {
    this.#apiKey = options.apiKey;
    this.#voiceId = options.voiceId;
    this.#generate = options.generate;
  }

  async synthesize(input: VoiceSynthesisInput): Promise<VoiceAudio> {
    if (!this.#apiKey || !this.#voiceId) throw new Error("Cartesia text-to-speech is not configured.");
    const generate = this.#generate ?? ((request) => new Cartesia({ apiKey: this.#apiKey }).tts.generate(request));
    const response = await generate({
      transcript: input.text,
      model_id: "sonic-3.6",
      voice: this.#voiceId,
      language: input.languageCode.split("-", 1)[0] ?? input.languageCode,
      output_format: { container: "mp3", sample_rate: 44_100, bit_rate: 128_000 },
    });
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength === 0) throw new Error("Cartesia text-to-speech returned empty audio.");
    return { data, mediaType: "audio/mpeg", languageCode: input.languageCode, fileName: "effi-response.mp3" };
  }
}

export const cartesiaVoiceProvider = new CartesiaVoiceProvider({
  apiKey: process.env.CARTESIA_API_KEY ?? "",
  voiceId: process.env.CARTESIA_VOICE_ID ?? "",
});
