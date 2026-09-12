import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";


const packageRequire = createRequire(
  new URL("../../apps/bot-gateway/package.json", import.meta.url),
);
const { streamText } = await import(packageRequire.resolve("ai"));
const { createOpenAI } = await import(packageRequire.resolve("@ai-sdk/openai"));
const { z } = await import(packageRequire.resolve("zod"));

const dataset = await readFile(
  new URL("./dataset/effi-training.jsonl", import.meta.url),
  "utf8",
);
const row = dataset
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line))
  .find((candidate) => candidate.id === "submission_high_en_1");
if (!row) throw new Error("Missing submission_high_en_1 fixture.");

const priority = z.object({
  priority: z.enum(["critical", "high", "medium", "low"]),
  reasons: z.array(z.string().min(1)).min(1).max(5),
});
const citation = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transcript_message"),
    sourceMessageId: z.string().min(1),
    explanation: z.string().min(1),
  }),
  z.object({
    kind: z.literal("accepted_evidence"),
    attachmentId: z.string().min(1),
    explanation: z.string().min(1),
  }),
]);
const inputSchema = z.object({
  summary: z.string().min(1).max(280),
  category: z.string().min(1),
  priority,
  citations: z.array(citation).min(1).max(10),
});

const provider = createOpenAI({
  name: "effi-model",
  baseURL: process.env.EFFI_MODEL_BASE_URL,
  apiKey: process.env.EFFI_MODEL_API_KEY,
});
const started = performance.now();
let firstChunkMilliseconds;
const result = streamText({
  model: provider.chat("effi-qwen3-vl-4b"),
  instructions: row.messages[0].content,
  messages: [{ role: "user", content: row.messages[1].content }],
  tools: {
    prepare_submission: {
      description: row.tools.find((candidate) => candidate.function.name === "prepare_submission").function.description,
      inputSchema,
    },
  },
  temperature: 0,
  maxOutputTokens: 320,
  onChunk() {
    firstChunkMilliseconds ??= performance.now() - started;
  },
});
await result.consumeStream();

const [toolCalls, finishReason] = await Promise.all([
  result.toolCalls,
  result.finishReason,
]);
const toolCall = toolCalls[0];
const output = {
  recordedAt: new Date().toISOString(),
  client: "ai-sdk",
  providerMethod: "chat",
  model: "effi-qwen3-vl-4b",
  firstChunkSeconds: Number(((firstChunkMilliseconds ?? 0) / 1000).toFixed(3)),
  totalSeconds: Number(((performance.now() - started) / 1000).toFixed(3)),
  finishReason,
  toolName: toolCall?.toolName,
  input: toolCall?.input,
  passed:
    finishReason === "tool-calls"
    && toolCall?.toolName === "prepare_submission"
    && toolCall.input.priority.priority === "high",
};
await writeFile(
  new URL("./outputs/ai-sdk-results.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(JSON.stringify(output, null, 2));
