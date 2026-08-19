import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type EvidenceBlob = {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly sourceReference: string;
  readonly storageKey: string;
};

export interface EvidenceStorage {
  copy(input: Omit<EvidenceBlob, "storageKey"> & { storageKey: string }): Promise<{ storageKey: string }>;
  read(storageKey: string): Promise<Uint8Array>;
  remove?(storageKey: string): Promise<void>;
}

const storagePath = (rootDirectory: string, storageKey: string): string => {
  const segments = storageKey.split("/");
  if (
    storageKey.length === 0 ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === ".." || segment.includes("\\"))
  ) {
    throw new Error("Evidence storage keys must contain safe relative path segments.");
  }
  return join(rootDirectory, ...segments);
};

export class MemoryEvidenceStorage implements EvidenceStorage {
  #files = new Map<string, EvidenceBlob>();

  async copy(input: EvidenceBlob): Promise<{ storageKey: string }> {
    this.#files.set(input.storageKey, { ...input, bytes: new Uint8Array(input.bytes) });
    return { storageKey: input.storageKey };
  }

  async read(storageKey: string): Promise<Uint8Array> {
    const blob = this.#files.get(storageKey);
    if (!blob) throw new Error("Evidence blob was not found.");
    return new Uint8Array(blob.bytes);
  }

  async remove(storageKey: string): Promise<void> {
    this.#files.delete(storageKey);
  }

  metadata(storageKey: string): Omit<EvidenceBlob, "bytes"> | undefined {
    const blob = this.#files.get(storageKey);
    if (!blob) return undefined;
    return { mediaType: blob.mediaType, sourceReference: blob.sourceReference, storageKey: blob.storageKey };
  }
}

export class FileEvidenceStorage implements EvidenceStorage {
  constructor(private readonly rootDirectory: string = process.env.EFFI_MEDIA_ROOT ?? ".effi/media") {}

  async copy(input: EvidenceBlob): Promise<{ storageKey: string }> {
    const path = storagePath(this.rootDirectory, input.storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.bytes);
    return { storageKey: input.storageKey };
  }

  async read(storageKey: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(storagePath(this.rootDirectory, storageKey)));
  }

  async remove(storageKey: string): Promise<void> {
    await rm(storagePath(this.rootDirectory, storageKey), { force: true });
  }
}
