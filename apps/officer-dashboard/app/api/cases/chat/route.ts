import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  generateText,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import type { CaseDetail } from "../../../../components/case-detail-types";
import { buildSystemInstructions } from "../../../../lib/case-context";
import { parseCaseChatMessageMetadata, type CaseChatMessageMetadata, type MemoryContextItem } from "../../../../lib/case-chat-message";
import {
  buildMemoryContext,
  caseMemoryUserId,
  createMemoryClient,
  officerMemoryUserId,
  rememberFacts,
  searchMemories,
} from "../../../../lib/memory";
import {
  SLA_CATEGORIES,
  SLA_EMBEDDING_DIMENSIONS,
  SLA_EMBEDDING_MODEL,
  SLA_QUERY_INSTRUCTION,
  type SlaCategory,
} from "../../../../lib/sla-knowledge";

const getCase = makeFunctionReference<"query", { caseId: string }, CaseDetail>("cases:getCase");
const createChat = makeFunctionReference<"mutation", { caseId: string; title: string }, { chatId: string }>("caseChat:createChat");
const appendMessage = makeFunctionReference<"mutation", { caseId: string; chatId: string; role: "user" | "assistant"; parts: unknown[]; metadata?: CaseChatMessageMetadata }, { messageId: string }>("caseChat:appendMessage");

type SlaSearchResult = {
  chunkId: string;
  documentKey: string;
  title: string;
  version: string;
  pageNumber: number;
  category: SlaCategory;
  heading: string;
  text: string;
  score: number;
  sourceUrl: string;
};

type RetrieveSlaInput = {
  query: string;
  category?: SlaCategory;
  topK?: number;
};

const searchSlaKnowledge = makeFunctionReference<"action", {
  embedding: number[];
  category?: SlaCategory;
  limit: number;
}, SlaSearchResult[]>("slaKnowledge:search");

const zenBaseURL = "https://opencode.ai/zen/v1";
const defaultModelId = "muse-spark-1.3-contributor-free";
const maxChatTitleLength = 80;
const minimumSlaScore = 0.45;

const sanitizeParts = (parts: unknown[]): unknown[] =>
  JSON.parse(JSON.stringify(parts ?? [])) as unknown[];

const isUIMessageArray = (value: unknown): value is UIMessage[] =>
  Array.isArray(value) && value.every((message) => message && typeof message === "object" && typeof (message as UIMessage).role === "string");

const firstUserText = (messages: UIMessage[]): string => {
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text" && part.text.trim()) return part.text.trim().slice(0, maxChatTitleLength);
    }
  }
  return "New chat";
};

const lastUserText = (messages: UIMessage[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type === "text" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
};

const textOfParts = (parts: Array<{ type: string; text?: string }>): string =>
  parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

const parseFactLists = (raw: string): { officer: string[]; case: string[] } => {
  const jsonText = raw.replace(/```(?:json)?/g, "").trim();
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start === -1 || end <= start) return { officer: [], case: [] };
  try {
    const parsed = JSON.parse(jsonText.slice(start, end + 1)) as { officer?: unknown; case?: unknown };
    const toStrings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return { officer: toStrings(parsed.officer), case: toStrings(parsed.case) };
  } catch {
    return { officer: [], case: [] };
  }
};

const extractFacts = async (
  provider: ReturnType<typeof createOpenAI>["responses"],
  modelId: string,
  turn: { userText: string; assistantText: string },
): Promise<{ officer: string[]; case: string[] }> => {
  const { text } = await generateText({
    model: provider(modelId),
    prompt: [
      "Below is one exchange between an officer and a case assistant. Extract durable facts worth remembering.",
      "",
      "Return ONLY JSON: {\"officer\": [...], \"case\": [...]}",
      "- \"officer\": durable facts about the officer as a person/professional (preferences, role, working style). Empty list if none.",
      "- \"case\": durable facts about the specific case being discussed (established findings, decisions, corrections, stated intent). Empty list if none.",
      "- Never extract transient phrasing, pleasantries, or anything already obvious from a single case view.",
      "- Each fact: one short standalone sentence.",
      "",
      `OFFICER MESSAGE: ${turn.userText.slice(0, 2000)}`,
      "",
      `ASSISTANT REPLY: ${turn.assistantText.slice(0, 2000)}`,
    ].join("\n"),
  });
  return parseFactLists(text);
};

export async function POST(request: Request) {
  const { isAuthenticated, getToken, userId } = await auth();
  if (!isAuthenticated) return new Response("unauthorized", { status: 401 });
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) return new Response("unauthorized", { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("invalid request", { status: 400 });
  const { caseId, chatId: requestedChatId, messages } = body as Record<string, unknown>;
  if (typeof caseId !== "string" || !caseId) return new Response("invalid request", { status: 400 });
  if (!isUIMessageArray(messages)) return new Response("invalid request", { status: 400 });

  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) return new Response("case chat unavailable", { status: 503 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return new Response("case chat unavailable", { status: 503 });

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);
  let detail: CaseDetail;
  try {
    detail = await convex.query(getCase, { caseId });
  } catch {
    return new Response("case unavailable", { status: 404 });
  }

  let chatId = typeof requestedChatId === "string" && requestedChatId ? requestedChatId : null;
  try {
    if (!chatId) {
      const created = await convex.mutation(createChat, { caseId, title: firstUserText(messages) });
      chatId = created.chatId;
    }
  } catch {
    return new Response("case chat unavailable", { status: 502 });
  }
  const activeChatId: string = chatId;

  const trigger = typeof (body as Record<string, unknown>).trigger === "string" ? (body as Record<string, unknown>).trigger : "submit-message";
  const lastMessage = messages.at(-1);
  if (trigger === "submit-message" && lastMessage?.role === "user") {
    try {
      await convex.mutation(appendMessage, { caseId, chatId: activeChatId, role: "user", parts: sanitizeParts(lastMessage.parts) });
    } catch {
      return new Response("case chat unavailable", { status: 502 });
    }
  }

  const provider = createOpenAI({
    baseURL: zenBaseURL,
    apiKey,
    headers: {
      "user-agent": "opencode/1.0 ai-sdk",
      "x-opencode-client": "cli",
      "x-opencode-project": "global",
      "x-opencode-session": `ses_casechat_${caseId}`,
      "x-opencode-request": `req_${crypto.randomUUID()}`,
    },
  });

  const memoryClient = createMemoryClient();
  const modelId = process.env.EFFI_CASE_CHAT_MODEL ?? defaultModelId;
  let memoryBlock = "";
  let memoryContext: MemoryContextItem[] = [];
  if (memoryClient) {
    const query = lastUserText(messages);
    if (query) {
      try {
        const [caseHits, officerHits] = await Promise.all([
          searchMemories(memoryClient, query, caseMemoryUserId(caseId), 3).catch(() => []),
          searchMemories(memoryClient, query, officerMemoryUserId(userId ?? ""), 3).catch(() => []),
        ]);
        memoryContext = [
          ...caseHits.map((memory) => ({ ...memory, scope: "case" as const })),
          ...officerHits.map((memory) => ({ ...memory, scope: "officer" as const })),
        ];
        memoryBlock = buildMemoryContext([...caseHits, ...officerHits]);
      } catch (error) {
        console.error("Failed to search memories", error);
      }
    }
  }

  const instructions = memoryBlock
    ? `${buildSystemInstructions(detail)}\n\n${memoryBlock}`
    : buildSystemInstructions(detail);

  const modelMessages = await convertToModelMessages(messages);
  const uiStream = createUIMessageStream({
    originalMessages: messages,
    execute: ({ writer }) => {
      const emittedSources = new Set<string>();
      const result = streamText({
        model: provider.responses(modelId),
        instructions,
        messages: modelMessages,
        stopWhen: isStepCount(6),
        tools: {
          retrieve_sla_manual: tool({
            description: "Search the active Effi municipal operations manual for SLA targets, ownership, escalation, evidence, exceptions, and closure procedures. Call again with a narrower query when one search is insufficient.",
            inputSchema: jsonSchema<RetrieveSlaInput>({
              type: "object",
              additionalProperties: false,
              required: ["query"],
              properties: {
                query: {
                  type: "string",
                  minLength: 3,
                  maxLength: 500,
                  description: "A focused semantic search written for the manual, not a copy of the officer's entire message.",
                },
                category: {
                  type: "string",
                  enum: [...SLA_CATEGORIES],
                  description: "Optional issue category filter. Use general for cross-service rules.",
                },
                topK: {
                  type: "integer",
                  minimum: 1,
                  maximum: 8,
                  description: "Number of page passages to retrieve. Defaults to 4.",
                },
              },
            }),
            execute: async ({ query, category, topK }) => {
              if (!process.env.AI_GATEWAY_API_KEY) {
                return { status: "unavailable" as const, reason: "The SLA embedding service is not configured." };
              }
              try {
                const { embedding } = await embed({
                  model: SLA_EMBEDDING_MODEL,
                  value: `${SLA_QUERY_INSTRUCTION}\n\nQuery: ${query}`,
                });
                if (embedding.length !== SLA_EMBEDDING_DIMENSIONS) {
                  return { status: "unavailable" as const, reason: "The SLA embedding model returned an incompatible vector." };
                }
                const matches = await convex.action(searchSlaKnowledge, {
                  embedding,
                  ...(category ? { category } : {}),
                  limit: topK ?? 4,
                });
                const reliableMatches = matches.filter((match) => match.score >= minimumSlaScore);
                if (!reliableMatches.length) {
                  return { status: "not_found" as const, reason: "No manual page met the relevance threshold." };
                }
                for (const match of reliableMatches) {
                  const sourceId = `sla-${match.chunkId}`;
                  if (emittedSources.has(sourceId)) continue;
                  emittedSources.add(sourceId);
                  writer.write({
                    type: "source-url",
                    sourceId,
                    url: match.sourceUrl,
                    title: `${match.title} v${match.version}, p. ${match.pageNumber}`,
                  });
                }
                return {
                  status: "found" as const,
                  matches: reliableMatches.map((match) => ({
                    citationId: `sla-${match.chunkId}`,
                    title: match.title,
                    version: match.version,
                    pageNumber: match.pageNumber,
                    category: match.category,
                    heading: match.heading,
                    passage: match.text,
                    sourceUrl: match.sourceUrl,
                  })),
                };
              } catch (error) {
                console.error("Failed to retrieve SLA manual", error);
                return { status: "unavailable" as const, reason: "The SLA manual search failed." };
              }
            },
          }),
        },
      });
      writer.merge(toUIMessageStream({
        stream: result.stream,
        messageMetadata: () => memoryContext.length > 0 ? { memoryContext } : undefined,
      }));
    },
    onEnd: async ({ responseMessage }) => {
      if (!responseMessage.parts.length) return;
      try {
        const responseMetadata = parseCaseChatMessageMetadata(responseMessage.metadata);
        await convex.mutation(appendMessage, {
          caseId,
          chatId: activeChatId,
          role: "assistant",
          parts: sanitizeParts(responseMessage.parts),
          ...(responseMetadata.memoryContext ? { metadata: responseMetadata } : {}),
        });
      } catch (error) {
        console.error("Failed to persist case chat message", error);
      }
      if (!memoryClient) return;
      const userText = lastUserText(messages);
      const assistantText = textOfParts(responseMessage.parts);
      if (!userText || !assistantText) return;
      try {
        const facts = await extractFacts(provider.responses, modelId, { userText, assistantText });
        await Promise.allSettled([
          rememberFacts(memoryClient, officerMemoryUserId(userId ?? ""), facts.officer),
          rememberFacts(memoryClient, caseMemoryUserId(caseId), facts.case),
        ]);
      } catch (error) {
        console.error("Failed to store memories", error);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: uiStream,
    headers: { "x-effi-chat-id": activeChatId },
  });
}
