import { describe, expect, it } from "vitest";
import { buildCaseContext, buildSystemInstructions } from "./case-context";
import type { CaseDetail } from "../components/case-detail-types";

function makeDetail(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    case: {
      reportNumber: "EF-1001",
      summary: "Overflowing bin on the corner",
      category: "sanitation",
      location: { source: "current_gps", latitude: 12.9716, longitude: 77.5946 },
      reportedAt: 1_700_000_000_000,
      submittedAt: 1_700_000_600_000,
      recommendedPriority: "high",
      currentPriority: "high",
      priorityReasons: ["Public health risk"],
      citations: [{ kind: "transcript_message", sourceMessageId: "m1", explanation: "Citizen described the overflow" }],
      acceptedEvidence: [{
        attachmentId: "att_1",
        storageKey: "key",
        url: null,
        mediaType: "image/jpeg",
        sourceMessageId: "m1",
      }],
      channel: "telegram",
      conversationId: "conv_1",
      status: "new",
      assignment: null,
      repostCount: 4,
      canAct: false,
    },
    transcript: [
      {
        sourceMessageId: "m1",
        sequence: 1,
        direction: "citizen",
        occurredAt: 1_700_000_000_000,
        content: { kind: "citizen_message", text: "The bin has not been emptied for a week.", attachments: [] },
      },
      {
        sourceMessageId: "m2",
        sequence: 2,
        direction: "effi",
        occurredAt: 1_700_000_100_000,
        content: { kind: "effi_message", text: "Thanks, I noted the overflowing bin." },
      },
    ],
    audit: [],
    ...overrides,
  };
}

describe("case context builder", () => {
  it("tags transcript messages with their anchor ids", () => {
    const context = buildCaseContext(makeDetail());
    expect(context).toContain("[message-m1] citizen at");
    expect(context).toContain("[message-m2] Effi (assistant) at");
  });

  it("tags accepted evidence with anchor ids", () => {
    const context = buildCaseContext(makeDetail());
    expect(context).toContain("[evidence-att_1] image/jpeg attached to [message-m1]");
  });

  it("renders input requests with their options", () => {
    const detail = makeDetail({
      transcript: [{
        sourceMessageId: "m3",
        sequence: 3,
        direction: "effi",
        occurredAt: 1_700_000_200_000,
        content: {
          kind: "input_request",
          text: "Pick one",
          requestId: "r1",
          prompt: "How urgent is it?",
          options: [{ id: "o1", label: "Very" }],
          allowFreeform: false,
        },
      }],
    });
    const context = buildCaseContext(detail);
    expect(context).toContain("How urgent is it?");
    expect(context).toContain("options: Very");
  });

  it("keeps instructions grounded and forbids fabricated citations", () => {
    const instructions = buildSystemInstructions(makeDetail());
    expect(instructions).toContain("only from the case data");
    expect(instructions).toContain("call retrieve_sla_manual");
    expect(instructions).toContain("Do not invent a target or procedure");
    expect(instructions).toContain("[message-m1]");
    expect(instructions).toContain("EF-1001");
  });

  it("lists the nearby repost count as a case fact", () => {
    const context = buildCaseContext(makeDetail());
    expect(context).toContain("Nearby reposts within 3 km: 4");
  });
});
