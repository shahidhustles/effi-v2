import { v } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import {
  caseStatusValidator,
  caseTranscriptContentValidator,
  exactLocationValidator,
  issueCategoryValidator,
  priorityValidator,
  sourceCitationValidator,
} from "./case_contract";

const maxInboxCases = 50;

const officerRole = v.union(v.literal("officer"), v.literal("admin"));

const requireOfficer = async (ctx: QueryCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to view cases.");
  const actor = await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", identity.tokenIdentifier)).unique();
  if (!actor || (actor.role !== "officer" && actor.role !== "admin")) throw new Error("Only officers can view cases.");
  return actor;
};

export const provisionOfficer = internalMutation({
  args: { externalId: v.string(), role: officerRole },
  returns: v.object({ identityId: v.id("identities"), role: officerRole }),
  handler: async (ctx, args) => {
    const externalId = args.externalId.trim();
    if (!externalId) throw new Error("Provisioning requires the Clerk token identifier.");
    const existing = await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", externalId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return { identityId: existing._id, role: args.role };
    }
    const identityId = await ctx.db.insert("identities", { externalId, role: args.role });
    return { identityId, role: args.role };
  },
});

export const listCases = query({
  args: {},
  returns: v.array(v.object({
    caseId: v.id("cases"),
    reportId: v.id("reports"),
    reportNumber: v.string(),
    summary: v.string(),
    category: issueCategoryValidator,
    status: caseStatusValidator,
    currentPriority: priorityValidator,
    reportedAt: v.number(),
    submittedAt: v.number(),
    channel: v.string(),
  })),
  handler: async (ctx) => {
    await requireOfficer(ctx);
    return await Promise.all(
      (await ctx.db.query("cases")
        .withIndex("by_submitted_at")
        .order("desc")
        .take(maxInboxCases))
        .map((entry) => ({
          caseId: entry._id,
          reportId: entry.reportId,
          reportNumber: entry.reportNumber,
          summary: entry.summary,
          category: entry.category,
          status: entry.status,
          currentPriority: entry.currentPriority,
          reportedAt: entry.reportedAt,
          submittedAt: entry.submittedAt,
          channel: entry.channel,
        })),
    );
  },
});

export const getCase = query({
  args: { caseId: v.id("cases") },
  returns: v.object({
    case: v.object({
      reportId: v.id("reports"),
      reportNumber: v.string(),
      summary: v.string(),
      category: issueCategoryValidator,
      location: exactLocationValidator,
      reportedAt: v.number(),
      submittedAt: v.number(),
      recommendedPriority: priorityValidator,
      currentPriority: priorityValidator,
      priorityReasons: v.array(v.string()),
      citations: v.array(sourceCitationValidator),
      acceptedEvidence: v.array(v.object({
        attachmentId: v.string(),
        storageKey: v.string(),
        mediaType: v.string(),
        sourceMessageId: v.string(),
      })),
      channel: v.string(),
      conversationId: v.string(),
      status: caseStatusValidator,
    }),
    transcript: v.array(v.object({
      sourceMessageId: v.string(),
      sequence: v.number(),
      direction: v.union(v.literal("citizen"), v.literal("effi")),
      occurredAt: v.number(),
      content: caseTranscriptContentValidator,
    })),
  }),
  handler: async (ctx, args) => {
    await requireOfficer(ctx);
    const record = await ctx.db.get(args.caseId);
    if (!record) throw new Error("Unknown case.");
    const transcript = await ctx.db.query("caseTranscriptMessages")
      .withIndex("by_case_id_and_sequence", (q) => q.eq("caseId", record._id))
      .order("asc")
      .collect();
    return {
      case: {
        reportId: record.reportId,
        reportNumber: record.reportNumber,
        summary: record.summary,
        category: record.category,
        location: record.location,
        reportedAt: record.reportedAt,
        submittedAt: record.submittedAt,
        recommendedPriority: record.recommendedPriority,
        currentPriority: record.currentPriority,
        priorityReasons: record.priorityReasons,
        citations: record.citations,
        acceptedEvidence: record.acceptedEvidence,
        channel: record.channel,
        conversationId: record.conversationId,
        status: record.status,
      },
      transcript: transcript.map((message) => ({
        sourceMessageId: message.sourceMessageId,
        sequence: message.sequence,
        direction: message.direction,
        occurredAt: message.occurredAt,
        content: message.content,
      })),
    };
  },
});
