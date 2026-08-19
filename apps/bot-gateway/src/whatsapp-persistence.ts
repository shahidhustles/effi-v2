import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { AtomicFileWriter } from "./atomic-file-writer.js";

export type MediaStorageCopy = {
  messageId: string;
  attachmentId: string;
  mediaType: string;
  data: Buffer;
};

export interface EffiMediaStorage {
  copy(input: MediaStorageCopy): Promise<{ storageKey: string }>;
  remove?(storageKey: string): Promise<void>;
}

export interface ProviderMessageDedupe {
  claim(messageId: string): Promise<boolean>;
  complete?(messageId: string): Promise<void>;
  release?(messageId: string): Promise<void>;
}

/** @deprecated Use ProviderMessageDedupe for new channel integrations. */
export type WhatsAppMessageDedupe = ProviderMessageDedupe;

type PersistedDedupe = { completed: string[]; inFlight: Record<string, number> };
type RawObject = Record<string, unknown>;
const asRecord = (value: unknown): RawObject | undefined => (
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as RawObject : undefined
);

export const safeStorageSegment = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";
const mediaExtension = (mediaType: string): string => safeStorageSegment(mediaType.split("/")[1] ?? "bin");

/** Durable provider-ID gate for a single always-on channel process. */
export class FileMessageDedupe implements ProviderMessageDedupe {
  #completed = new Set<string>();
  #inFlight = new Map<string, number>();
  #loaded?: Promise<void>;
  readonly #writer: AtomicFileWriter;

  constructor(
    private readonly filePath: string,
    private readonly maxEntries = 10_000,
    private readonly claimLeaseMs = 5 * 60_000,
  ) {
    this.#writer = new AtomicFileWriter(filePath);
  }

  async claim(messageId: string): Promise<boolean> {
    await this.#load();
    if (this.#completed.has(messageId)) return false;
    const claimedAt = this.#inFlight.get(messageId);
    if (claimedAt !== undefined && Date.now() - claimedAt < this.claimLeaseMs) return false;
    this.#inFlight.set(messageId, Date.now());
    try {
      await this.#persist();
    } catch (error) {
      this.#inFlight.delete(messageId);
      throw error;
    }
    return true;
  }

  async complete(messageId: string): Promise<void> {
    await this.#load();
    this.#inFlight.delete(messageId);
    this.#completed.add(messageId);
    while (this.#completed.size > this.maxEntries) {
      const oldest = this.#completed.values().next().value;
      if (oldest === undefined) break;
      this.#completed.delete(oldest);
    }
    await this.#persist();
  }

  async release(messageId: string): Promise<void> {
    await this.#load();
    this.#inFlight.delete(messageId);
    await this.#persist();
  }

  #load(): Promise<void> {
    this.#loaded ??= (async () => {
      try {
        const stored: unknown = JSON.parse(await readFile(this.filePath, "utf8"));
        if (Array.isArray(stored)) {
          for (const messageId of stored) if (typeof messageId === "string") this.#completed.add(messageId);
        } else {
          const persisted = asRecord(stored);
          const completed = persisted?.completed;
          if (Array.isArray(completed)) {
            for (const messageId of completed) if (typeof messageId === "string") this.#completed.add(messageId);
          }
          const inFlight = asRecord(persisted?.inFlight);
          for (const [messageId, claimedAt] of Object.entries(inFlight ?? {})) {
            if (typeof claimedAt === "number" && Number.isFinite(claimedAt)) this.#inFlight.set(messageId, claimedAt);
          }
        }
      } catch (error) {
        const code = error instanceof Error && "code" in error ? error.code : undefined;
        if (code !== "ENOENT") throw error;
      }
    })();
    return this.#loaded;
  }

  #persist(): Promise<void> {
    const persisted: PersistedDedupe = { completed: [...this.#completed], inFlight: Object.fromEntries(this.#inFlight) };
    return this.#writer.write(JSON.stringify(persisted));
  }
}

/** Controlled local media storage for the staged WhatsApp transport. */
export class FileMediaStorage implements EffiMediaStorage {
  constructor(private readonly rootDirectory: string) {}

  async copy(input: MediaStorageCopy): Promise<{ storageKey: string }> {
    const relativePath = join(
      "whatsapp",
      `${safeStorageSegment(input.messageId)}-${safeStorageSegment(input.attachmentId)}.${mediaExtension(input.mediaType)}`,
    );
    const absolutePath = join(this.rootDirectory, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.data);
    return { storageKey: `effi/${relativePath.split("\\").join("/")}` };
  }

  async read(storageKey: string): Promise<Uint8Array> {
    if (!storageKey.startsWith("effi/whatsapp/")) throw new Error("The WhatsApp evidence key is invalid.");
    const root = resolve(this.rootDirectory);
    const absolutePath = resolve(root, storageKey.slice("effi/".length));
    if (!absolutePath.startsWith(`${root}${sep}`)) throw new Error("The WhatsApp evidence key is invalid.");
    return readFile(absolutePath);
  }

  async remove(storageKey: string): Promise<void> {
    if (!storageKey.startsWith("effi/whatsapp/")) throw new Error("The WhatsApp evidence key is invalid.");
    const root = resolve(this.rootDirectory);
    const absolutePath = resolve(root, storageKey.slice("effi/".length));
    if (!absolutePath.startsWith(`${root}${sep}`)) throw new Error("The WhatsApp evidence key is invalid.");
    await rm(absolutePath, { force: true });
  }
}
