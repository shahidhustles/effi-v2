import { describe, expect, it, vi } from "vitest";
import {
  VoiceConversationPreferences,
  detectTextLanguage,
  isReportReadyForReview,
  pendingVoiceMessage,
  retryTransientOperation,
  transcribeInboundVoice,
  type VoiceFetch,
} from "../src/voice.js";
import { CartesiaVoiceProvider } from "../src/cartesia-voice-provider.js";
import { DeepgramVoiceProvider } from "../src/deepgram-voice-provider.js";
import { sendTelegramVoice } from "../src/telegram-voice-delivery.js";
import { SharedReportIngress, SimulatedReportStore } from "../src/index.js";

const jsonResponse = (body: unknown): Response => Response.json(body);

describe("configured voice providers", () => {
  it("transcribes a staged voice note with Deepgram Nova-3 and keeps the detected language", async () => {
    const transcribeFile = vi.fn(async () => ({
      results: {
        channels: [{
          detected_language: "hi",
          alternatives: [{ transcript: "सड़क पर बड़ा गड्ढा है" }],
        }],
      },
    }));
    const provider = new DeepgramVoiceProvider({ apiKey: "deepgram-test-key", transcribeFile });

    await expect(provider.transcribe({
      data: Buffer.from("voice-bytes"),
      mediaType: "audio/ogg",
      fileName: "citizen-note.ogg",
    })).resolves.toEqual({
      status: "transcribed",
      transcript: "सड़क पर बड़ा गड्ढा है",
      languageCode: "hi-IN",
    });
    expect(transcribeFile).toHaveBeenCalledWith(
      { data: Buffer.from("voice-bytes"), contentType: "audio/ogg" },
      { model: "nova-3", detect_language: true, smart_format: true, punctuate: true },
    );
  });

  it("returns an explicit recovery status when Deepgram finds no speech", async () => {
    const provider = new DeepgramVoiceProvider({
      apiKey: "deepgram-test-key",
      transcribeFile: async () => ({ results: { channels: [{ alternatives: [{ transcript: "" }] }] } }),
    });

    await expect(provider.transcribe({ data: Buffer.from("voice"), mediaType: "audio/ogg" }))
      .resolves.toEqual({ status: "unintelligible" });
  });

  it("generates Cartesia Sonic 3.5 audio without exposing encoded data to the channel", async () => {
    const generate = vi.fn(async () => new Response(Buffer.from("audio-bytes")));
    const provider = new CartesiaVoiceProvider({ apiKey: "cartesia-test-key", voiceId: "hindi-voice", generate });

    const audio = await provider.synthesize({ text: "कृपया फिर से बोलें।", languageCode: "hi-IN" });

    expect(generate).toHaveBeenCalledWith({
      transcript: "कृपया फिर से बोलें।",
      model_id: "sonic-3.5",
      voice: "hindi-voice",
      language: "hi",
      output_format: { container: "mp3", sample_rate: 44_100, bit_rate: 128_000 },
    });
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
  it("retries a transient provider operation only once", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce("recovered");

    await expect(retryTransientOperation(operation)).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

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
