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
      category: "drainage",
      status: "new",
      currentPriority: "high",
      channel: "telegram",
      isAssignedToMe: false,
    });
  });

  it("returns only open cases with map fields to a provisioned officer", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const openCaseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });
    await t.run(async (ctx) => {
      const openCase = await ctx.db.get(openCaseId);
      if (!openCase) throw new Error("Seeded case is missing.");
      await ctx.db.insert("cases", {
        reportId: openCase.reportId,
        reportNumber: "RPT-resolved",
        summary: openCase.summary,
        category: openCase.category,
        location: openCase.location,
        reportedAt: openCase.reportedAt,
        recommendedPriority: openCase.recommendedPriority,
        currentPriority: openCase.currentPriority,
        priorityReasons: openCase.priorityReasons,
        citations: openCase.citations,
        acceptedEvidence: openCase.acceptedEvidence,
        channel: openCase.channel,
        conversationId: openCase.conversationId,
        status: "resolved",
        submittedAt: openCase.submittedAt + 1,
      });
    });

    const heatmapCases = await t.withIdentity(officerIdentity).query(api.cases.listHeatmapCases, {});
    expect(heatmapCases).toEqual([{
      caseId: openCaseId,
      summary: "Blocked storm drain flooding the street.",
      status: "new",
      currentPriority: "high",
      location: { source: "current_gps", latitude: 3.139, longitude: 101.6869 },
      submittedAt: Date.parse("2026-09-10T09:00:00.000Z"),
    }]);
  });

  it("protects the heatmap query with officer authorization", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    await seedCase(t);

    await expect(t.query(api.cases.listHeatmapCases, {})).rejects.toThrow(/sign in/i);
    await expect(t.withIdentity(citizenIdentity).query(api.cases.listHeatmapCases, {})).rejects.toThrow(/only officers/i);
  });

  it("marks cases assigned to the current officer", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });

    await t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId });
    const inbox = await t.withIdentity(officerIdentity).query(api.cases.listCases, {});

    expect(inbox[0]?.isAssignedToMe).toBe(true);
  });

  it("returns the case with ordered two-sided transcript and evidence", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "admin" });

    const detail = await t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId });
    expect(detail.case.summary).toBe("Blocked storm drain flooding the street.");
    expect(detail.case.repostCount).toBe(0);
    expect(detail.case.location).toEqual({ source: "current_gps", latitude: 3.139, longitude: 101.6869 });
    expect(detail.case.acceptedEvidence).toEqual(acceptedEvidence.map((evidence) => ({ ...evidence, url: null })));
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

  it("stores a trimmed display name and updates it later", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|officer-demo", role: "officer", displayName: "  Sarthak Markad  " });
    await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|officer-demo", role: "officer", displayName: "Sarthak M" });
    await t.run(async (ctx) => {
      const identity = await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", "clerk|officer-demo")).unique();
      expect(identity?.displayName).toBe("Sarthak M");
    });
  });
});

describe("officer roster", () => {
  it("lists named officers and admins with the caller marked", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    await seedCase(t);
    const me = { tokenIdentifier: "clerk|shahid", subject: "shahid", name: "Shahid Patel" };
    const provisionedMe = await t.mutation(internal.cases.provisionOfficer, { externalId: me.tokenIdentifier, role: "officer", displayName: "Shahid Patel" });
    const provisionedSarthak = await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|sarthak", role: "officer", displayName: "Sarthak Markad" });
    await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|unnamed", role: "officer" });
    const provisionedAdmin = await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|admin", role: "admin", displayName: "Anita Rao" });

    const roster = await t.withIdentity(me).query(api.cases.listOfficers, {});
    expect(roster).toEqual([
      { officerId: provisionedAdmin.identityId, name: "Anita Rao", isMe: false },
      { officerId: provisionedSarthak.identityId, name: "Sarthak Markad", isMe: false },
      { officerId: provisionedMe.identityId, name: "Shahid Patel", isMe: true },
    ]);
    await expect(t.withIdentity(citizenIdentity).query(api.cases.listOfficers, {})).rejects.toThrow(/only officers/i);
  });
});

describe("officer case actions", () => {
  it("uses standard Clerk name claims when the combined name claim is absent", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    const splitNameIdentity = {
      tokenIdentifier: "clerk|split-name-officer",
      subject: "split-name-officer",
      givenName: "Shahid",
      familyName: "Patel",
    };
    await t.mutation(internal.cases.provisionOfficer, { externalId: splitNameIdentity.tokenIdentifier, role: "officer" });

    await t.withIdentity(splitNameIdentity).mutation(api.cases.assignCase, { caseId });

    const detail = await t.withIdentity(splitNameIdentity).query(api.cases.getCase, { caseId });
    expect(detail.case.assignment).toEqual({ officerName: "Shahid Patel" });
    expect(detail.audit.every((entry) => entry.actorName === "Shahid Patel")).toBe(true);
  });

  it("assigns the signed-in officer and records assignment plus status history", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });

    await t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId });

    const detail = await t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId });
    expect(detail.case).toMatchObject({ status: "assigned", assignment: { officerName: "Demo Officer" }, canAct: true });
    expect(detail.audit.map((entry) => entry.event.kind)).toEqual(["case_assigned", "status_changed"]);
    expect(detail.audit.every((entry) => entry.actorName === "Demo Officer")).toBe(true);
  });

  it("allows the assignee to override priority without a note and advance linearly", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });
    await t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId });

    await t.withIdentity(officerIdentity).mutation(api.cases.overridePriority, { caseId, priority: "critical" });
    await t.withIdentity(officerIdentity).mutation(api.cases.advanceCaseStatus, { caseId, action: { kind: "advance" } });
    await t.withIdentity(officerIdentity).mutation(api.cases.advanceCaseStatus, { caseId, action: { kind: "advance" } });
    await expect(t.withIdentity(officerIdentity).mutation(api.cases.advanceCaseStatus, {
      caseId,
      action: { kind: "resolve", resolutionNote: "   " },
    })).rejects.toThrow(/resolution note/i);
    await t.withIdentity(officerIdentity).mutation(api.cases.advanceCaseStatus, {
      caseId,
      action: { kind: "resolve", resolutionNote: "Drain cleared and standing water removed." },
    });

    const detail = await t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId });
    expect(detail.case).toMatchObject({ status: "resolved", currentPriority: "critical", canAct: false });
    expect(detail.audit.at(-1)?.event).toEqual({
      kind: "case_resolved",
      from: "work_in_progress",
      to: "resolved",
      resolutionNote: "Drain cleared and standing water removed.",
    });
  });

  it("rejects another officer but permits an administrator to update an assigned case", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    const secondOfficer = { tokenIdentifier: "clerk|officer-two", subject: "officer-two", name: "Second Officer" };
    const administrator = { tokenIdentifier: "clerk|admin-demo", subject: "admin-demo", name: "Demo Admin" };
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });
    await t.mutation(internal.cases.provisionOfficer, { externalId: secondOfficer.tokenIdentifier, role: "officer" });
    await t.mutation(internal.cases.provisionOfficer, { externalId: administrator.tokenIdentifier, role: "admin" });
    await t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId });

    await expect(t.withIdentity(secondOfficer).mutation(api.cases.overridePriority, { caseId, priority: "low" }))
      .rejects.toThrow(/assigned officer/i);
    await t.withIdentity(administrator).mutation(api.cases.overridePriority, { caseId, priority: "low" });

    const detail = await t.withIdentity(administrator).query(api.cases.getCase, { caseId });
    expect(detail.case.currentPriority).toBe("low");
    expect(detail.audit.at(-1)?.actorName).toBe("Demo Admin");
  });

  it("hands a new case to another officer and names both officers in the audit", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    const target = { tokenIdentifier: "clerk|officer-target", subject: "officer-target", name: "Target Officer" };
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });
    const provisioned = await t.mutation(internal.cases.provisionOfficer, { externalId: target.tokenIdentifier, role: "officer", displayName: "Sarthak Markad" });

    await t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId, officerId: provisioned.identityId });

    const detail = await t.withIdentity(officerIdentity).query(api.cases.getCase, { caseId });
    expect(detail.case.assignment).toEqual({ officerName: "Sarthak Markad" });
    expect(detail.audit.find((entry) => entry.event.kind === "case_assigned")).toMatchObject({
      actorName: "Demo Officer",
      event: { kind: "case_assigned", assignedOfficerId: provisioned.identityId, assignedOfficerName: "Sarthak Markad" },
    });
    const targetDetail = await t.withIdentity(target).query(api.cases.getCase, { caseId });
    expect(targetDetail.case.canAct).toBe(true);
  });

  it("rejects assignment to a citizen or to an officer without a name", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.*s"));
    const caseId = await seedCase(t);
    await t.mutation(internal.cases.provisionOfficer, { externalId: officerIdentity.tokenIdentifier, role: "officer" });
    const citizenRecord = await t.run(async (ctx) => await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", citizenIdentity.tokenIdentifier)).unique());
    const unnamed = await t.mutation(internal.cases.provisionOfficer, { externalId: "clerk|unnamed", role: "officer" });

    await expect(t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId, officerId: citizenRecord!._id }))
      .rejects.toThrow(/choose an officer/i);
    await expect(t.withIdentity(officerIdentity).mutation(api.cases.assignCase, { caseId, officerId: unnamed.identityId }))
      .rejects.toThrow(/needs a name/i);
  });
});
