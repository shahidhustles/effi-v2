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
    prompt: request.prompt,
    options: (request.options ?? []).map((option) => ({ id: option.id, label: option.label })),
    allowFreeform: request.allowFreeform ?? false,
  };
  return {
    eventId: `${event.meta.id}:${request.requestId}`,
    occurredAt: occurredAtFor(event.meta),
    text: request.prompt,
    source: "input_request",
    inputRequest,
  };
});
