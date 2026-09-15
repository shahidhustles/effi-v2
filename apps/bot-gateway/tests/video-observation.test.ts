import { describe, expect, it } from "vitest";
import {
  SharedReportIngress,
  SimulatedReportStore,
  createVideoObservationProvider,
} from "../src/index.js";

describe("createVideoObservationProvider", () => {
  it("sends the video as a data URL and returns the trimmed observation", async () => {
    const calls: { url: string; body: { input: { content: { type: string; video_url?: string }[] }[] } }[] = [];
    const provider = createVideoObservationProvider({
      baseUrl: "https://model.test/v1/",
      apiKey: "test-key",
      modelId: "muse-spark-1.3-contributor-free",
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return Response.json({
          output: [{ type: "message", content: [{ type: "output_text", text: "  A water-filled pothole.  " }] }],
        });
      }) as typeof fetch,
    });

    const observation = await provider({ data: new Uint8Array([1, 2, 3]), mediaType: "video/mp4" });

    expect(observation).toBe("A water-filled pothole.");
    expect(calls[0]?.url).toBe("https://model.test/v1/responses");
    const videoPart = calls[0]?.body.input[0]?.content.find((part) => part.type === "input_video");
    expect(videoPart?.video_url).toBe(`data:video/mp4;base64,${Buffer.from([1, 2, 3]).toString("base64")}`);
  });

  it("returns undefined when the endpoint fails", async () => {
    const provider = createVideoObservationProvider({
      baseUrl: "https://model.test/v1",
      apiKey: "test-key",
      fetch: (async () => new Response("unavailable", { status: 503 })) as typeof fetch,
    });

    await expect(provider({ data: new Uint8Array([1]), mediaType: "video/mp4" })).resolves.toBeUndefined();
  });

  it("returns undefined without configuration", async () => {
    const provider = createVideoObservationProvider({ baseUrl: "", apiKey: "" });

    await expect(provider({ data: new Uint8Array([1]), mediaType: "video/mp4" })).resolves.toBeUndefined();
  });
});

describe("video evidence context", () => {
  it("exposes the video id and its observation to the model", () => {
    const store = new SimulatedReportStore(() => "2026-09-14T10:00:00.000Z");
    const ingress = new SharedReportIngress(store);
    const record = ingress.accept({
      id: "telegram:42:14",
      channel: "telegram",
      conversationId: "42",
      senderId: "7",
      attachments: [{
        id: "video-14",
        kind: "video",
        mediaType: "video/mp4",
        platformUrl: "telegram-file:video-14",
        platformReference: "telegram:file:video-14",
        storageKey: "effi/telegram/42/14/video-14.video",
        observation: "A water-filled pothole covers the lane.",
      }],
      receivedAt: "2026-09-14T10:00:00.000Z",
    });

    const context = ingress.contextFor(record!);
    expect(context).toContain("effi_controlled_video_ids: video-14");
    expect(context).toContain("video_observation_video-14: A water-filled pothole covers the lane.");
  });
});
