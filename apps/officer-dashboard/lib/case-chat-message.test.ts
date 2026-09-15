import { describe, expect, it } from "vitest";
import { parseCaseChatMessageMetadata, parseMemoryContext } from "./case-chat-message";

describe("case chat message metadata", () => {
  it("keeps valid memory context records", () => {
    expect(parseMemoryContext([
      { id: "case-1", text: "The lamp was inspected yesterday.", scope: "case" },
      { id: "officer-1", text: "The officer prefers concise updates.", scope: "officer" },
    ])).toHaveLength(2);
  });

  it("drops malformed records at the persistence boundary", () => {
    expect(parseCaseChatMessageMetadata({
      memoryContext: [
        { id: "case-1", text: "Valid memory.", scope: "case" },
        { id: 2, text: "Invalid memory.", scope: "case" },
      ],
    })).toEqual({
      memoryContext: [{ id: "case-1", text: "Valid memory.", scope: "case" }],
    });
  });
});
