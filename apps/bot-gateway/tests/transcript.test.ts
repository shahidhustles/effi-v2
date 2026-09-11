import { describe, expect, it } from "vitest";
import {
  completedMessageTranscriptEntry,
  inputRequestTranscriptEntries,
  isReportConfirmationRequest,
} from "../agent/lib/transcript.js";

describe("two-sided report transcript", () => {
  it("captures a delivered terminal assistant message with the stable Eve event ID", () => {
    expect(completedMessageTranscriptEntry({
      meta: { id: "evt_reply", at: "2026-09-11T10:00:00.000Z" },
      data: { message: "Please confirm the pothole report.", finishReason: "stop" },
    })).toEqual({
      eventId: "evt_reply",
      occurredAt: Date.parse("2026-09-11T10:00:00.000Z"),
      text: "Please confirm the pothole report.",
      source: "assistant_message",
    });
  });

  it("does not capture narration that the channel does not deliver", () => {
    expect(completedMessageTranscriptEntry({
      meta: { id: "evt_tool", at: "2026-09-11T10:00:00.000Z" },
      data: { message: "I will inspect that image.", finishReason: "tool-calls" },
    })).toBeUndefined();
  });

  it("captures question prompts and options as structured transcript data", () => {
    expect(inputRequestTranscriptEntries({
      meta: { id: "evt_question", at: "2026-09-11T10:01:00.000Z" },
      data: {
        requests: [{
          requestId: "req_confirm",
          prompt: "Is this interpretation correct?",
          options: [{ id: "confirm", label: "Confirm" }, { id: "edit", label: "Edit" }],
          allowFreeform: false,
        }],
      },
    })).toEqual([{
      eventId: "evt_question:req_confirm",
      occurredAt: Date.parse("2026-09-11T10:01:00.000Z"),
      text: "Is this interpretation correct?",
      source: "input_request",
      inputRequest: {
        requestId: "req_confirm",
        prompt: "Is this interpretation correct?",
        options: [{ id: "confirm", label: "Confirm" }, { id: "edit", label: "Edit" }],
        allowFreeform: false,
      },
    }]);
  });

  it("recognizes only the report confirmation choice", () => {
    expect(isReportConfirmationRequest({
      options: [{ id: "confirm", label: "Confirm" }, { id: "edit", label: "Edit" }],
    })).toBe(true);
    expect(isReportConfirmationRequest({
      options: [{ id: "confirm", label: "Confirm" }, { id: "cancel", label: "Cancel" }],
    })).toBe(false);
  });
});
