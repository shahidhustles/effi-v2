import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

export type VideoObservationInput = {
  readonly data: Uint8Array;
  readonly mediaType: string;
};

export type VideoObservationProvider = (input: VideoObservationInput) => Promise<string | undefined>;

export type VideoObservationOptions = {
  baseUrl?: string;
  apiKey?: string;
  modelId?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxObservationCharacters?: number;
  reasoningEffort?: string;
};

export const videoObservationPrompt = [
  "This is a short citizen video of a civic issue.",
  "Describe only what is visible: the type of issue, the condition of the road or area, and any immediate hazard.",
  "Mention roughly when in the clip the issue is clearest.",
  "Do not guess facts that are not visible.",
].join(" ");

/**
 * Observe a staged video through the OpenCode Zen vision model and return a
 * short, grounded description. The citizen's turn injects this text as the
 * visible content of the video, because channel file parts never carry video
 * bytes to the model. Failures return undefined so a video problem cannot
 * block the report conversation.
 */
export const createVideoObservationProvider = (options: VideoObservationOptions = {}): VideoObservationProvider => async (input) => {
  const baseUrl = (options.baseUrl ?? process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/zen/v1").replace(/\/+$/u, "");
  const apiKey = options.apiKey ?? process.env.OPENCODE_API_KEY;
  const modelId = options.modelId ?? process.env.OPENCODE_MODEL ?? "muse-spark-1.3-contributor-free";
  if (!baseUrl || !apiKey) return undefined;

  const sessionId = `ses_effi_video_${randomUUID()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
  try {
    const response = await (options.fetch ?? fetch)(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "user-agent": "opencode/1.0 ai-sdk",
        "x-opencode-client": "cli",
        "x-opencode-project": "global",
        "x-opencode-session": sessionId,
        "x-opencode-request": `${sessionId}_req`,
      },
      body: JSON.stringify({
        model: modelId,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: videoObservationPrompt },
              { type: "input_video", video_url: `data:${input.mediaType};base64,${Buffer.from(input.data).toString("base64")}` },
            ],
          },
        ],
        max_output_tokens: 1_200,
        reasoning: { effort: options.reasoningEffort ?? "low" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return undefined;
    const body = await response.json() as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };
    const content = (body.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    if (content.length === 0) return undefined;
    return content.slice(0, options.maxObservationCharacters ?? 600);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
};
