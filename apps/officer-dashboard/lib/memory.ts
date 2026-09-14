import MemoryClient from "mem0ai";

export type MemoryRecord = {
  id: string;
  text: string;
  updatedAt: string | null;
};

export const officerMemoryUserId = (clerkId: string): string => `officer_${clerkId}`;
export const caseMemoryUserId = (caseId: string): string => `case_${caseId}`;

const maxMemoryTextLength = 200;
const maxMemoriesPerScope = 50;

export const createMemoryClient = (): MemoryClient | null => {
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) return null;
  return new MemoryClient({ apiKey });
};

const toRecords = (memories: Array<{ id?: string; memory?: string; updatedAt?: Date | string | null }>): MemoryRecord[] =>
  memories
    .filter((memory): memory is { id: string; memory: string; updatedAt?: Date | string | null } => typeof memory.id === "string" && typeof memory.memory === "string")
    .map((memory) => ({
      id: memory.id,
      text: memory.memory.slice(0, maxMemoryTextLength),
      updatedAt: memory.updatedAt instanceof Date ? memory.updatedAt.toISOString() : typeof memory.updatedAt === "string" ? memory.updatedAt : null,
    }));

export const listMemories = async (client: MemoryClient, userId: string): Promise<MemoryRecord[]> => {
  const response = await client.getAll({ filters: { user_id: userId }, pageSize: maxMemoriesPerScope });
  return toRecords(response.results);
};

export const searchMemories = async (client: MemoryClient, query: string, userId: string, topK: number): Promise<MemoryRecord[]> => {
  const response = await client.search(query, { filters: { user_id: userId }, topK });
  return toRecords(response.results);
};

const normalizeFact = (fact: string): string => fact.trim().replace(/\s+/g, " ").toLowerCase();

export const rememberFacts = async (client: MemoryClient, userId: string, facts: string[]): Promise<void> => {
  const cleaned = facts
    .map((fact) => fact.trim().slice(0, maxMemoryTextLength))
    .filter(Boolean);
  if (!cleaned.length) return;
  const existing = await listMemories(client, userId);
  const known = new Set(existing.map((memory) => normalizeFact(memory.text)));
  const fresh = cleaned.filter((fact) => !known.has(normalizeFact(fact)));
  if (!fresh.length) return;
  await Promise.allSettled(
    fresh.map((fact) =>
      client.add([{ role: "user", content: fact }], {
        userId,
        infer: false,
        metadata: { source: "case_chat" },
      }),
    ),
  );
};

export const buildMemoryContext = (records: MemoryRecord[]): string => {
  if (!records.length) return "";
  return [
    "WHAT YOU REMEMBER about this officer and this case (from earlier conversations):",
    ...records.map((record) => `- ${record.text}`),
    "",
    "Treat these as standing instructions and background context. Honor them in every answer. Case data below always wins over memories for case facts.",
  ].join("\n");
};
