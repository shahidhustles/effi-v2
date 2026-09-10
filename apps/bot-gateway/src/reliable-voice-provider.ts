import { cartesiaVoiceProvider } from "./cartesia-voice-provider.js";
import { deepgramVoiceProvider } from "./deepgram-voice-provider.js";
import { retryTransientOperation, type VoiceProvider } from "./voice.js";

export const reliableVoiceProvider: VoiceProvider = {
  transcribe: (input) => retryTransientOperation(() => deepgramVoiceProvider.transcribe(input)),
  synthesize: (input) => retryTransientOperation(() => cartesiaVoiceProvider.synthesize(input)),
};
