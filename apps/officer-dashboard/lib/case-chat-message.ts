export type MemoryContextItem = {
  id: string;
  text: string;
  scope: "case" | "officer";
};

export type CaseChatMessageMetadata = {
  memoryContext?: MemoryContextItem[];
};

const isMemoryContextItem = (value: unknown): value is MemoryContextItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && typeof item.text === "string"
    && (item.scope === "case" || item.scope === "officer");
};

export const parseMemoryContext = (value: unknown): MemoryContextItem[] => (
  Array.isArray(value) ? value.filter(isMemoryContextItem) : []
);

export const parseCaseChatMessageMetadata = (value: unknown): CaseChatMessageMetadata => {
  if (!value || typeof value !== "object") return {};
  const metadata = value as Record<string, unknown>;
  const memoryContext = parseMemoryContext(metadata.memoryContext);
  return memoryContext.length > 0 ? { memoryContext } : {};
};
