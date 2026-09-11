export type EffiTranscriptEntry = {
  eventId: string;
  occurredAt: number;
  text: string;
  source: "assistant_message" | "input_request";
  inputRequest?: {
    requestId: string;
    prompt: string;
    options: { id: string; label: string }[];
    allowFreeform: boolean;
  };
};

type InputRequest = {
  options?: readonly { id: string; label: string }[] | undefined;
};

/**
 * Some models wrap the question in a JSON envelope instead of passing plain
 * text; the citizen-facing prompt and the immutable transcript must hold the
 * unwrapped text and the canonical lowercase option ids.
 */
const unwrapPrompt = (prompt: string): string => {
  const match = /^\s*\{\s*"prompt"\s*:/u.exec(prompt);
  if (!match) return prompt;
  try {
    const parsed: unknown = JSON.parse(prompt);
    if (typeof parsed === "object" && parsed !== null && typeof (parsed as { prompt?: unknown }).prompt === "string") {
      return (parsed as { prompt: string }).prompt;
    }
  } catch {
    // keep the original text when the envelope is not valid JSON
  }
  return prompt;
};

const canonicalOptionId = (id: string): string => id.toLowerCase();

export const isReportConfirmationRequest = (request: InputRequest): boolean => {
  const optionIds = new Set((request.options ?? []).map((option) => option.id));
  return optionIds.size === 2 && optionIds.has("confirm") && optionIds.has("edit");
};

type EventMeta = { id: string; at: string };

const occurredAtFor = (meta: EventMeta): number => {
  const occurredAt = Date.parse(meta.at);
  if (!Number.isFinite(occurredAt)) throw new Error("Eve transcript event has an invalid timestamp.");
  return occurredAt;
};

export const completedMessageTranscriptEntry = (event: {
  meta: EventMeta;
  data: { message: string | null; finishReason: string };
}): EffiTranscriptEntry | undefined => {
  if (!event.data.message || event.data.finishReason === "tool-calls") return undefined;
  return {
    eventId: event.meta.id,
    occurredAt: occurredAtFor(event.meta),
    text: event.data.message,
    source: "assistant_message",
  };
};

export const inputRequestTranscriptEntries = (event: {
  meta: EventMeta;
  data: {
    requests?: readonly {
      requestId: string;
      prompt: string;
      options?: readonly { id: string; label: string }[] | undefined;
      allowFreeform?: boolean | undefined;
    }[];
  };
}): EffiTranscriptEntry[] => (event.data.requests ?? []).map((request) => {
  const inputRequest = {
    requestId: request.requestId,
    prompt: unwrapPrompt(request.prompt),
    options: (request.options ?? []).map((option) => ({ id: canonicalOptionId(option.id), label: option.label })),
    allowFreeform: request.allowFreeform ?? false,
  };
  return {
    eventId: `${event.meta.id}:${request.requestId}`,
    occurredAt: occurredAtFor(event.meta),
    text: inputRequest.prompt,
    source: "input_request",
    inputRequest,
  };
});
