import { describe, expect, it } from "vitest";
import { uploadAcceptedEvidence } from "../src/convex-report-store.js";

const evidence = {
  attachmentId: "photo-1",
  storageKey: "effi/telegram/42/photo-1",
  mediaType: "image/jpeg",
  sourceMessageId: "telegram:42:10",
};

describe("Convex evidence uploads", () => {
  it("uploads accepted evidence and returns the Convex storage ID", async () => {
    const uploadedBodies: Uint8Array[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      uploadedBodies.push(new Uint8Array(await new Response(init?.body).arrayBuffer()));
      return new Response(JSON.stringify({ storageId: "storage-photo-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await uploadAcceptedEvidence({
      evidence,
      channel: "telegram",
      readEvidence: async ({ storageKey }) => {
        expect(storageKey).toBe(evidence.storageKey);
        return new Uint8Array([1, 2, 3]);
      },
      generateUploadUrl: async () => "https://upload.convex.test",
      fetcher,
    });

    expect(result).toEqual({ ...evidence, storageId: "storage-photo-1" });
    expect(uploadedBodies).toEqual([new Uint8Array([1, 2, 3])]);
  });

  it("rejects a failed upload before persisting the pending submission", async () => {
    await expect(uploadAcceptedEvidence({
      evidence,
      channel: "whatsapp",
      readEvidence: async () => new Uint8Array([1]),
      generateUploadUrl: async () => "https://upload.convex.test",
      fetcher: async () => new Response("failed", { status: 503 }),
    })).rejects.toThrow(/status 503/u);
  });
});
