import { describe, expect, it } from "vitest";
import { SimulatedReportStore } from "../src/simulated-report-registration.js";

const now = () => "2026-09-11T04:27:17.000Z";

const confirmedJourney = () => {
  const store = new SimulatedReportStore(now, {
    authenticationBaseUrl: "https://auth.effi.test/claim",
    tokenFactory: () => "one-time-token",
  });
  const inbound = {
    id: "telegram:7993389847:203",
    channel: "telegram" as const,
    conversationId: "7993389847",
    senderId: "7993389847",
    text: "theres a pothole on my main road",
    attachments: [{ id: "AgAC-photo-1", kind: "image" as const, mediaType: "image/jpeg", platformUrl: "telegram-file:AgAC-photo-1" }],
    location: { source: "selected_pin" as const, latitude: 18.457916, longitude: 73.873965 },
    receivedAt: now(),
  };
  const conversation = store.startConversation(inbound);
  store.persistInbound(conversation, inbound);
  store.applyInboundFacts(conversation, store.persistedMessage("telegram", "7993389847", inbound.id)!);
  store.markAttachmentInspected("telegram", "7993389847", "AgAC-photo-1");
  store.recordAttachmentQuality("telegram", "7993389847", "AgAC-photo-1", "satisfactory");
  store.recordConfirmationReview("telegram", "7993389847");
  return { store, conversation };
};

describe("record_report_interpretation freezes the citizen-facing interpretation", () => {
  const journeyWithLeadingNoise = () => {
    const store = new SimulatedReportStore(now, {
      authenticationBaseUrl: "https://auth.effi.test/claim",
      tokenFactory: () => "one-time-token",
    });
    const greeting = {
      id: "telegram:7993389847:201",
      channel: "telegram" as const,
      conversationId: "7993389847",
      senderId: "7993389847",
      text: "/start",
      receivedAt: now(),
    };
    const conversation = store.startConversation(greeting);
    store.persistInbound(conversation, greeting);
    store.applyInboundFacts(conversation, store.persistedMessage("telegram", "7993389847", greeting.id)!);
    const report = {
      id: "telegram:7993389847:203",
      channel: "telegram" as const,
      conversationId: "7993389847",
      senderId: "7993389847",
      text: "pothole on my main road",
      attachments: [{ id: "AgAC-photo-1", kind: "image" as const, mediaType: "image/jpeg", platformUrl: "telegram-file:AgAC-photo-1" }],
      location: { source: "selected_pin" as const, latitude: 18.458012, longitude: 73.873838 },
      receivedAt: now(),
    };
    store.persistInbound(conversation, report);
    store.applyInboundFacts(conversation, store.persistedMessage("telegram", "7993389847", report.id)!);
    store.markAttachmentInspected("telegram", "7993389847", "AgAC-photo-1");
    store.recordAttachmentQuality("telegram", "7993389847", "AgAC-photo-1", "satisfactory");
    return store;
  };

  it("freezes the declared interpretation even when the first citizen text was a slash command", () => {
    const store = journeyWithLeadingNoise();
    expect(store.activeConversation("telegram", "7993389847")?.issue).toBe("/start");

    store.recordReviewInterpretation("telegram", "7993389847", { issue: "Pothole on main road", category: "roads" });
    const pending = store.prepareSubmission({
      channel: "telegram",
      conversationId: "7993389847",
      caseBrief: {
        summary: "Pothole on the main road needs repair.",
        category: "roads",
        priority: { priority: "high", reasons: ["Vehicles must swerve into oncoming traffic."] },
        citations: [
          { kind: "transcript_message", sourceMessageId: "telegram:7993389847:203", explanation: "Citizen reported the pothole." },
          { kind: "accepted_evidence", attachmentId: "AgAC-photo-1", explanation: "The accepted photo shows the pothole." },
        ],
      },
      receivedAt: now(),
    });

    const frozen = store.pendingSubmission(pending.authenticationLink);
    expect(frozen?.interpretation.issue).toBe("Pothole on main road");
    expect(frozen?.interpretation.category).toBe("roads");
    expect(frozen?.interpretation.location).toEqual({ source: "selected_pin", latitude: 18.458012, longitude: 73.873838 });
  });

  it("refuses to record an interpretation without a location or accepted evidence", () => {
    const store = new SimulatedReportStore(now);
    const first = {
      id: "telegram:7993389847:201",
      channel: "telegram" as const,
      conversationId: "7993389847",
      senderId: "7993389847",
      text: "The streetlight is broken.",
      receivedAt: now(),
    };
    const conversation = store.startConversation(first);
    store.persistInbound(conversation, first);
    store.applyInboundFacts(conversation, store.persistedMessage("telegram", "7993389847", first.id)!);

    expect(() => store.recordReviewInterpretation("telegram", "7993389847", { issue: "Broken streetlight", category: "lighting" }))
      .toThrow("An exact location is required");
  });
});

describe("prepare_submission uses the confirmed interpretation", () => {
  it("creates the pending submission from the recorded review even when the model paraphrased the issue", () => {
    const { store, conversation } = confirmedJourney();

    const pending = store.prepareSubmission({
      channel: "telegram",
      conversationId: "7993389847",
      caseBrief: {
        summary: "Pothole blocking the main road.",
        category: "roads",
        priority: { priority: "high", reasons: ["Vehicles must swerve into oncoming traffic."] },
        citations: [
          { kind: "transcript_message", sourceMessageId: "telegram:7993389847:203", explanation: "Citizen described the pothole." },
          { kind: "accepted_evidence", attachmentId: "AgAC-photo-1", explanation: "The accepted photo shows the pothole." },
        ],
      },
      receivedAt: now(),
    });

    expect(pending.authenticationLink).toBe("https://auth.effi.test/claim/one-time-token");
    const frozen = store.pendingSubmission(pending.authenticationLink);
    expect(frozen?.interpretation.issue).toBe("theres a pothole on my main road");
    expect(frozen?.interpretation.category).toBe("roads");
    expect(frozen?.interpretation.location).toEqual({ source: "selected_pin", latitude: 18.457916, longitude: 73.873965 });
    expect(frozen?.acceptedEvidence).toEqual([{
      attachmentId: "AgAC-photo-1",
      storageKey: expect.stringMatching(/^effi\//),
      mediaType: "image/jpeg",
      sourceMessageId: "telegram:7993389847:203",
    }]);
    // The tool no longer takes the restated facts, so no mismatch is possible.
    // The case brief keeps the model's summary and reasons as authored.
    expect(frozen?.caseBrief.summary).toBe("Pothole blocking the main road.");
    expect(frozen?.caseBrief.priority.reasons).toEqual(["Vehicles must swerve into oncoming traffic."]);
    expect(conversation.phase).toBe("authentication_pending");
  });

  it("rejects a case brief whose category does not match the confirmed category", () => {
    const { store } = confirmedJourney();

    expect(() => store.prepareSubmission({
      channel: "telegram",
      conversationId: "7993389847",
      caseBrief: {
        summary: "Pothole blocking the main road.",
        category: "water",
        priority: { priority: "high", reasons: ["Vehicles must swerve around it."] },
        citations: [{ kind: "accepted_evidence", attachmentId: "AgAC-photo-1", explanation: "The accepted photo shows the pothole." }],
      },
      receivedAt: now(),
    })).toThrow("The case brief category must match the confirmed category.");
  });

  it("rejects citations outside the confirmed conversation or evidence", () => {
    const { store } = confirmedJourney();

    expect(() => store.prepareSubmission({
      channel: "telegram",
      conversationId: "7993389847",
      caseBrief: {
        summary: "Pothole blocking the main road.",
        category: "roads",
        priority: { priority: "high", reasons: ["Vehicles must swerve around it."] },
        citations: [{ kind: "transcript_message", sourceMessageId: "telegram:other-chat:1", explanation: "Not this conversation." }],
      },
      receivedAt: now(),
    })).toThrow("cites a transcript message");

    expect(() => store.prepareSubmission({
      channel: "telegram",
      conversationId: "7993389847",
      caseBrief: {
        summary: "Pothole blocking the main road.",
        category: "roads",
        priority: { priority: "high", reasons: ["Vehicles must swerve around it."] },
        citations: [{ kind: "accepted_evidence", attachmentId: "AgAC-photo-other", explanation: "Never accepted." }],
      },
      receivedAt: now(),
    })).toThrow("cites evidence that was not accepted");
  });
});
