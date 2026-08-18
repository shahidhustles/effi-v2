import { cartesiaVoiceProvider } from "./cartesia-voice-provider.js";
import { sarvamVoiceProvider } from "./sarvam-voice-provider.js";
import { withVoiceSynthesisFallback } from "./voice.js";

export const reliableVoiceProvider = withVoiceSynthesisFallback(sarvamVoiceProvider, cartesiaVoiceProvider);
