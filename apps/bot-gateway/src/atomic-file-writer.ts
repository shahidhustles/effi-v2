import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Serialize recoverable atomic writes to one local state file. */
export class AtomicFileWriter {
  #queue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  write(contents: string): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`;
    this.#queue = this.#queue.catch(() => undefined).then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, contents, "utf8");
      await rename(temporaryPath, this.filePath);
    });
    return this.#queue;
  }
}
