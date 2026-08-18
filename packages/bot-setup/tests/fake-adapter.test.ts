import { describe, expect, it } from "vitest";
import { FakeChannelAdapter } from "../src/index.js";

describe("FakeChannelAdapter", () => {
  it("records outbound messages", async () => {
    const adapter = new FakeChannelAdapter();
    await adapter.send({ channel: "telegram", conversationId: "conversation_1", text: "Hello" });
    expect(adapter.sent).toHaveLength(1);
  });
});
