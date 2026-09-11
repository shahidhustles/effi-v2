import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const officerIdentity = { tokenIdentifier: "clerk|officer-demo", subject: "officer-demo", name: "Demo Officer" };
const citizenIdentity = { tokenIdentifier: "clerk|citizen-demo", subject: "citizen-demo", name: "Demo Citizen" };

const acceptedEvidence = [{
  attachmentId: "att-photo-1",
  storageKey: "evidence/att-photo-1.bin",
  mediaType: "image/jpeg",
  sourceMessageId: "msg-photo-1",
}];

const caseBriefCitations = [
  { kind: "transcript_message" as const, sourceMessageId: "msg-citizen-1", explanation: "Citizen described the collapsed drain." },
  { kind: "accepted_evidence" as const, attachmentId: "att-photo-1", explanation: "Photo shows standing water over the drain." },
];

const seedCase = async (t: ReturnType<typeof convexTest>) => t.run(async (ctx) => {
  const citizenId = await ctx.db.insert("identities", { externalId: citizenIdentity.tokenIdentifier, role: "citizen" });
  const pendingSubmissionId = await ctx.db.insert("pendingSubmissions", {
    draftId: undefined,
    claimTokenHash: "hash-seed",
    scopeKey: "scope-seed",
    channel: "telegram",
    conversationId: "conv-seed",
    expiresAt: Date.parse("2026-09-12T00:00:00.000Z"),
    issue: "Drain overflow",
    category: "drainage",
    location: { source: "current_gps", latitude: 3.139, longitude: 101.6869 },
    primaryEvidence: acceptedEvidence,
    reportedAt: Date.parse("2026-09-10T08:00:00.000Z"),
    caseBrief: {
      summary: "Blocked storm drain flooding the street.",
      category: "drainage",
      priority: { priority: "high", reasons: ["Standing water is spreading across the road."] },
      citations: caseBriefCitations,
    },
  });
  const reportId = await ctx.db.insert("reports", {
    pendingSubmissionId,
    citizenId,
    reportNumber: "RPT-seed-1",
    channel: "telegram",
    conversationId: "conv-seed",
    issue: "Drain overflow",
    category: "drainage",
    location: { source: "current_gps", latitude: 3.139, longitude: 101.6869 },
    primaryEvidence: acceptedEvidence,
    reportedAt: Date.parse("2026-09-10T08:00:00.000Z"),
    submittedAt: Date.parse("2026-09-10T09:00:00.000Z"),
  });
  const caseId = await ctx.db.insert("cases", {
    reportId,
    reportNumber: "RPT-seed-1",
    summary: "Blocked storm drain flooding the street.",
    category: "drainage",
    location: { source: "current_gps", latitude: 3.139, longitude: 101.6869 },
    reportedAt: Date.parse("2026-09-10T08:00:00.000Z"),
    submittedAt: Date.parse("2026-09-10T09:00:00.000Z"),
    recommendedPriority: "high",
    currentPriority: "high",
    priorityReasons: ["Standing water is spreading across the road."],
    citations: caseBriefCitations,
    acceptedEvidence,
    channel: "telegram",
    conversationId: "conv-seed",
    status: "new",
  });
  await ctx.db.insert("caseTranscriptMessages", {
    caseId,
    sourceMessageId: "msg-citizen-1",
    sequence: 0,
    direction: "citizen",
    occurredAt: Date.parse("2026-09-10T08:00:00.000Z"),
    content: { kind: "citizen_message", text: "The drain near my street is blocked.", attachments: [] },
  });
  await ctx.db.insert("caseTranscriptMessages", {
    caseId,
    sourceMessageId: "msg-effi-1",
    sequence: 1,
    direction: "effi",
    occurredAt: Date.parse("2026-09-10T08:00:01.000Z"),
    content: { kind: "input_request", text: "Please confirm.", requestId: "req-1", prompt: "Is the drain blocked?", options: [{ id: "yes", label: "Yes" }], allowFreeform: true },
  });
  await ctx.db.insert("caseTranscriptMessages", {
    caseId,
    sourceMessageId: "msg-citizen-2",
    sequence: 2,
    direction: "citizen",
    occurredAt: Date.parse("2026-09-10T08:00:02.000Z"),
    content: { kind: "citizen_message", action: "confirm", attachments: [] },
  });
  await ctx.db.insert("caseTranscriptMessages", {
    caseId,
    sourceMessageId: "msg-photo-1",
    sequence: 3,
    direction: "citizen",
    occurredAt: Date.parse("2026-09-10T08:00:03.000Z"),
    content: {
      kind: "citizen_message",
      attachments: [{ attachmentId: "att-photo-1", storageKey: "evidence/att-photo-1.bin", mediaType: "image/jpeg", accepted: true }],
    },
  });
  return caseId;
});

describe("case officer queries", () => {
  it("rejects a signed-out caller, a citizen, and an unprovisioned identity", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);

    await expect(t.query(api.cases.listCases, {})).rejects.toThrow(/sign in/i);
    await expect(t.query(api.cases.getCase, { caseId })).rejects.toThrow(/sign in/i);
    await expect(t.withIdentity(citizenIdentity).query(api.cases.listCases, {})).rejects.toThrow(/only officers/i);
    await expect(t.withIdentity(citizenIdentity).query(api.cases.getCase, { caseId })).rejects.toThrow(/only officers/i);
    await expect(t.withIdentity(officerIdentity).query(api.cases.listCases, {})).rejects.toThrow(/only officers/i);
    await expect(t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId })).rejects.toThrow(/only officers/i);
  });

  it("returns the inbox in submitted-time order for a provisioned officer", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });

    const inbox = await t.withIdentity(officerIdentity).query(api.cases.listCases, {});
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      reportNumber: "RPT-seed-1",
      category: "drainage",
      status: "new",
      currentPriority: "high",
      channel: "telegram",
    });
  });

  it("returns the case with ordered two-sided transcript and evidence", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "admin" });

    const detail = await t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId });
    expect(detail.case.summary).toBe("Blocked storm drain flooding the street.");
    expect(detail.case.location).toEqual({ source: "current_gps", latitude: 3.139, longitude: 101.6869 });
    expect(detail.case.acceptedEvidence).toEqual(acceptedEvidence);
    expect(detail.transcript.map((message) => message.sequence)).toEqual([0, 1, 2, 3]);
    expect(detail.transcript.map((message) => message.direction)).toEqual(["citizen", "effi", "citizen", "citizen"]);
    expect(detail.transcript[1]!.content).toMatchObject({ kind: "input_request", requestId: "req-1", allowFreeform: true });
    expect(detail.transcript[3]!.content).toMatchObject({ kind: "citizen_message", attachments: [{ attachmentId: "att-photo-1", accepted: true }] });
  });

  it("rejects an unknown case id even for a provisioned officer", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });
    const caseId = await seedCase(t);
    await t.run(async (ctx) => {
      const messages = await ctx.db.query("caseTranscriptMessages").filter((q) => q.eq(q.field("caseId"), caseId)).collect();
      for (const message of messages) await ctx.db.delete(message._id);
      await ctx.db.delete(caseId);
    });
    await expect(t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId })).rejects.toThrow(/unknown case/i);
  });
});

describe("officer provisioning", () => {
  it("provisions once and upgrades an existing identity without duplicating", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const first = await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|officer-demo", role: "officer" });
    expect(first.role).toBe("officer");
    const again = await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|officer-demo", role: "admin" });
    expect(again.identityId).toBe(first.identityId);
    expect(again.role).toBe("admin");
    await t.run(async (ctx) => {
      const identities = await ctx.db.query("identities").collect();
      expect(identities).toHaveLength(1);
      expect(identities[0]).toMatchObject({ externalId: "clerk|officer-demo", role: "admin" });
    });
  });
});
