import { aiGatewayVoiceProvider } from "./ai-gateway-voice-provider.js";
import { cartesiaVoiceProvider } from "./cartesia-voice-provider.js";
import { retryTransientOperation, type VoiceProvider } from "./voice.js";

export const reliableVoiceProvider: VoiceProvider = {
  transcribe: (input) => retryTransientOperation(() => aiGatewayVoiceProvider.transcribe(input)),
  synthesize: (input) => retryTransientOperation(() => cartesiaVoiceProvider.synthesize(input)),
};
