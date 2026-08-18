import { describe, expect, it, vi } from "vitest";
import {
  VoiceConversationPreferences,
  detectTextLanguage,
  isReportReadyForReview,
  pendingVoiceMessage,
  transcribeInboundVoice,
  type VoiceFetch,
} from "../src/voice.js";
import { sendTelegramVoice } from "../src/telegram-voice-delivery.js";
import { SarvamVoiceProvider } from "../src/sarvam-voice-provider.js";
import { SharedReportIngress, SimulatedReportStore } from "../src/index.js";

const jsonResponse = (body: unknown): Response => Response.json(body);

describe("SarvamVoiceProvider", () => {
  it("transcribes a staged voice note with Saaras v3 and keeps the detected language", async () => {
    const fetch: VoiceFetch = vi.fn(async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ "api-subscription-key": "sarvam-test-key" });
      expect(init?.body).toBeInstanceOf(FormData);
      const body = init?.body as FormData;
      expect(body.get("model")).toBe("saaras:v3");
      expect(body.get("mode")).toBe("codemix");
      expect((body.get("file") as File).name).toBe("citizen-note.ogg");
      return jsonResponse({ transcript: "सड़क पर बड़ा गड्ढा है", language_code: "hi-IN" });
    });
    const provider = new SarvamVoiceProvider({ apiKey: "sarvam-test-key", fetch });

    await expect(provider.transcribe({
      data: Buffer.from("voice-bytes"),
      mediaType: "audio/ogg",
      fileName: "citizen-note.ogg",
    })).resolves.toEqual({
      status: "transcribed",
      transcript: "सड़क पर बड़ा गड्ढा है",
      languageCode: "hi-IN",
    });
  });

  it("returns an explicit recovery status when Saaras cannot identify a language", async () => {
    const fetch: VoiceFetch = vi.fn(async () => jsonResponse({ transcript: "untrusted guess", language_code: null }));
    const provider = new SarvamVoiceProvider({ apiKey: "sarvam-test-key", fetch });

    await expect(provider.transcribe({ data: Buffer.from("voice"), mediaType: "audio/ogg" })).resolves.toEqual({
      status: "language_unknown",
    });
  });

  it("decodes Bulbul v3 audio without exposing base64 to the channel adapter", async () => {
    const fetch: VoiceFetch = vi.fn(async (_input, init) => {
      expect(init?.headers).toMatchObject({ "api-subscription-key": "sarvam-test-key", "content-type": "application/json" });
      expect(JSON.parse(String(init?.body))).toEqual({
        text: "कृपया फिर से बोलें।",
        target_language_code: "hi-IN",
        model: "bulbul:v3",
        speaker: "shubh",
        output_audio_codec: "mp3",
      });
      return jsonResponse({ audios: [Buffer.from("audio-bytes").toString("base64")] });
    });
    const provider = new SarvamVoiceProvider({ apiKey: "sarvam-test-key", fetch });

    const audio = await provider.synthesize({ text: "कृपया फिर से बोलें।", languageCode: "hi-IN" });

    expect(audio).toMatchObject({ mediaType: "audio/mpeg", languageCode: "hi-IN", fileName: "effi-response.mp3" });
    expect(audio.data).toEqual(Buffer.from("audio-bytes"));
  });

  it("delivers the provider audio through Telegram's multipart sendVoice endpoint", async () => {
    const fetch: VoiceFetch = vi.fn(async (_input, init) => {
      expect(String(_input)).toBe("https://telegram.test/botbot-token/sendVoice");
      expect(init?.method).toBe("POST");
      const body = init?.body as FormData;
      expect(body.get("chat_id")).toBe("42");
      expect(body.get("message_thread_id")).toBe("77");
      expect((body.get("voice") as File).name).toBe("response.mp3");
      return jsonResponse({ ok: true });
    });

    await expect(sendTelegramVoice({
      botToken: "bot-token",
      apiBaseUrl: "https://telegram.test",
      fetch,
      chatId: "42",
      messageThreadId: 77,
      audio: { data: Buffer.from("audio"), mediaType: "audio/mpeg", languageCode: "en-IN", fileName: "response.mp3" },
    })).resolves.toBeUndefined();
  });
});

describe("voice language detection", () => {
  it("maps representative Indian scripts to stable synthesis language codes", () => {
    expect(detectTextLanguage("यह हिंदी शिकायत है")).toBe("hi-IN");
    expect(detectTextLanguage("এটি একটি অভিযোগ")).toBe("bn-IN");
    expect(detectTextLanguage("ৰাস্তাটো বেয়া হৈছে")).toBe("as-IN");
    expect(detectTextLanguage("शाळेजवळ रस्ता खराब आहे")).toBe("mr-IN");
    expect(detectTextLanguage("இது ஒரு புகார்")).toBe("ta-IN");
    expect(detectTextLanguage("سڑک خراب ہے")).toBe("ur-IN");
    expect(detectTextLanguage("The road is broken")).toBe("en-IN");
  });

  it("identifies a completed report state without depending on response wording", () => {
    expect(isReportReadyForReview({
      phase: "gathering",
      issue: "A pothole is outside the school.",
      location: { latitude: 12, longitude: 77 },
      acceptedEvidence: [{}],
    })).toBe(true);
    expect(isReportReadyForReview({
      phase: "authentication_pending",
      issue: "A pothole is outside the school.",
      location: { latitude: 12, longitude: 77 },
      acceptedEvidence: [{}],
    })).toBe(false);
  });
});

describe("staged voice ingress", () => {
  const inbound = {
    id: "voice-message-1",
    channel: "telegram" as const,
    conversationId: "42",
    senderId: "7",
    attachments: [{
      id: "voice-message-1-audio",
      kind: "audio" as const,
      mediaType: "audio/ogg",
      platformUrl: "telegram-file:voice-message-1-audio",
      platformReference: "telegram:file:voice-message-1-audio",
      storageKey: "effi/telegram/42/voice-message-1/voice-message-1-audio.audio",
    }],
    receivedAt: "2026-08-18T12:00:00.000Z",
  };

  it("persists the detected transcript and language metadata without treating audio as photo evidence", async () => {
    const pending = pendingVoiceMessage(inbound, inbound.attachments[0]!);
    const store = new SimulatedReportStore();
    const ingress = new SharedReportIngress(store);
    const accepted = ingress.accept(pending);
    expect(accepted?.persisted.voice?.status).toBe("pending");

    const enriched = await transcribeInboundVoice(pending, {
      attachment: inbound.attachments[0]!,
      data: Buffer.from("voice-bytes"),
      fileName: "voice.ogg",
    }, {
      async transcribe(input) {
        expect(input.mediaType).toBe("audio/ogg");
        return { status: "transcribed", transcript: "A pothole is outside the school.", languageCode: "en-IN" };
      },
      async synthesize() {
        throw new Error("not used");
      },
    });
    const record = ingress.enrichVoice(accepted!, enriched);

    expect(record?.persisted.voice).toMatchObject({
      attachmentId: "voice-message-1-audio",
      status: "transcribed",
      languageCode: "en-IN",
    });
    expect(record?.persisted.voiceTranscript).toBe("A pothole is outside the school.");
    expect(record?.persisted.attachments).toEqual([expect.objectContaining({ kind: "audio" })]);
    expect(record?.conversation.acceptedEvidence).toEqual([]);
    expect(ingress.contextFor(record!)).toContain("voice_transcript: A pothole is outside the school.");
  });

  it("does not preserve a guessed transcript after a provider failure", async () => {
    const enriched = await transcribeInboundVoice(inbound, {
      attachment: inbound.attachments[0]!,
      data: Buffer.from("voice-bytes"),
    }, {
      async transcribe() {
        throw new Error("provider unavailable");
      },
      async synthesize() {
        throw new Error("not used");
      },
    });

    expect(enriched.voice).toMatchObject({ status: "failed" });
    expect(enriched.voiceTranscript).toBeUndefined();
  });

  it("lets the latest voice turn switch the response preference independently of the report session", () => {
    const preferences = new VoiceConversationPreferences();
    preferences.remember({ channel: "whatsapp", conversationId: "thread-1", text: "The road is broken" });
    preferences.remember({ channel: "whatsapp", conversationId: "thread-1", inputModality: "voice", languageCode: "hi-IN" });

    expect(preferences.get("whatsapp", "thread-1")).toEqual({ modality: "voice", languageCode: "hi-IN" });
  });
});
