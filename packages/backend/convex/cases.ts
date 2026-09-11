import { nextCaseStatus } from "@effi/case-workflow";
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  caseAuditEventValidator,
  channelValidator,
  caseStatusValidator,
  caseTranscriptContentValidator,
  exactLocationValidator,
  issueCategoryValidator,
  priorityValidator,
  sourceCitationValidator,
} from "./case_contract";

const maxInboxCases = 50;

const officerRole = v.union(v.literal("officer"), v.literal("admin"));
const maxResolutionNoteLength = 500;

const requireOfficer = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to view cases.");
  const actor = await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", identity.tokenIdentifier)).unique();
  if (!actor || (actor.role !== "officer" && actor.role !== "admin")) throw new Error("Only officers can view cases.");
  return { actor, actorName: identity.name?.trim() || "Officer" };
};

const requireCase = async (ctx: QueryCtx | MutationCtx, caseId: Id<"cases">) => {
  const record = await ctx.db.get(caseId);
  if (!record) throw new Error("Unknown case.");
  return record;
};

const requireAssignedActor = async (ctx: MutationCtx, caseId: Id<"cases">) => {
  const { actor, actorName } = await requireOfficer(ctx);
  const record = await requireCase(ctx, caseId);
  if (!record.assignedOfficerId) throw new Error("Assign this case before changing it.");
  if (actor.role !== "admin" && record.assignedOfficerId !== actor._id) {
    throw new Error("Only the assigned officer can change this case.");
  }
  if (record.status === "resolved") throw new Error("Resolved cases cannot be changed.");
  return { actor, actorName, record };
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
    channel: channelValidator,
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
        storageId: v.optional(v.id("_storage")),
        url: v.union(v.string(), v.null()),
        mediaType: v.string(),
        sourceMessageId: v.string(),
      })),
      channel: channelValidator,
      conversationId: v.string(),
      status: caseStatusValidator,
      assignment: v.union(v.object({ officerName: v.string() }), v.null()),
      canAct: v.boolean(),
    }),
    transcript: v.array(v.object({
      sourceMessageId: v.string(),
      sequence: v.number(),
      direction: v.union(v.literal("citizen"), v.literal("effi")),
      occurredAt: v.number(),
      content: caseTranscriptContentValidator,
    })),
    audit: v.array(v.object({
      eventId: v.id("caseAuditEvents"),
      actorName: v.string(),
      occurredAt: v.number(),
      event: caseAuditEventValidator,
    })),
  }),
  handler: async (ctx, args) => {
    const { actor } = await requireOfficer(ctx);
    const record = await requireCase(ctx, args.caseId);
    const transcript = await ctx.db.query("caseTranscriptMessages")
      .withIndex("by_case_id_and_sequence", (q) => q.eq("caseId", record._id))
      .order("asc")
      .collect();
    const audit = await ctx.db.query("caseAuditEvents")
      .withIndex("by_case_id_and_occurred_at", (q) => q.eq("caseId", record._id))
      .order("asc")
      .collect();
    const acceptedEvidence = await Promise.all(record.acceptedEvidence.map(async (evidence) => ({
      ...evidence,
      url: evidence.storageId ? await ctx.storage.getUrl(evidence.storageId) : null,
    })));
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
        acceptedEvidence,
        channel: record.channel,
        conversationId: record.conversationId,
        status: record.status,
        assignment: record.assignedOfficerId && record.assignedOfficerName
          ? { officerName: record.assignedOfficerName }
          : null,
        canAct: Boolean(
          record.status !== "resolved"
          && record.assignedOfficerId
          && (actor.role === "admin" || record.assignedOfficerId === actor._id),
        ),
      },
      transcript: transcript.map((message) => ({
        sourceMessageId: message.sourceMessageId,
        sequence: message.sequence,
        direction: message.direction,
        occurredAt: message.occurredAt,
        content: message.content,
      })),
      audit: audit.map((entry) => ({
        eventId: entry._id,
        actorName: entry.actorName,
        occurredAt: entry.occurredAt,
        event: entry.event,
      })),
    };
  },
});

export const assignCase = mutation({
  args: { caseId: v.id("cases") },
  returns: v.object({ status: v.literal("assigned"), officerName: v.string() }),
  handler: async (ctx, args) => {
    const { actor, actorName } = await requireOfficer(ctx);
    const record = await requireCase(ctx, args.caseId);
    const assignedStatus = "assigned" as const;
    if (record.assignedOfficerId) throw new Error("This case is already assigned.");
    if (record.status !== "new") throw new Error("Only a new case can be assigned.");
    const occurredAt = Date.now();
    await ctx.db.patch(record._id, { assignedOfficerId: actor._id, assignedOfficerName: actorName, status: assignedStatus });
    await ctx.db.insert("caseAuditEvents", {
      caseId: record._id,
      actorIdentityId: actor._id,
      actorName,
      occurredAt,
      event: { kind: "case_assigned", assignedOfficerId: actor._id },
    });
    await ctx.db.insert("caseAuditEvents", {
      caseId: record._id,
      actorIdentityId: actor._id,
      actorName,
      occurredAt,
      event: { kind: "status_changed", from: "new", to: "assigned" },
    });
    return { status: assignedStatus, officerName: actorName };
  },
});

export const overridePriority = mutation({
  args: { caseId: v.id("cases"), priority: priorityValidator },
  returns: v.object({ priority: priorityValidator }),
  handler: async (ctx, args) => {
    const { actor, actorName, record } = await requireAssignedActor(ctx, args.caseId);
    if (record.currentPriority === args.priority) throw new Error("Choose a different priority.");
    await ctx.db.patch(record._id, { currentPriority: args.priority });
    await ctx.db.insert("caseAuditEvents", {
      caseId: record._id,
      actorIdentityId: actor._id,
      actorName,
      occurredAt: Date.now(),
      event: { kind: "priority_changed", from: record.currentPriority, to: args.priority },
    });
    return { priority: args.priority };
  },
});

export const advanceCaseStatus = mutation({
  args: {
    caseId: v.id("cases"),
    action: v.union(
      v.object({ kind: v.literal("advance") }),
      v.object({ kind: v.literal("resolve"), resolutionNote: v.string() }),
    ),
  },
  returns: v.object({ status: caseStatusValidator }),
  handler: async (ctx, args) => {
    const { actor, actorName, record } = await requireAssignedActor(ctx, args.caseId);
    const nextStatus = nextCaseStatus(record.status);
    if (!nextStatus || nextStatus === "assigned") throw new Error("This case cannot advance from its current status.");
    const occurredAt = Date.now();
    if (nextStatus === "resolved") {
      if (args.action.kind !== "resolve") throw new Error("A resolution note is required to resolve this case.");
      const resolutionNote = args.action.resolutionNote.trim();
      if (!resolutionNote || resolutionNote.length > maxResolutionNoteLength) {
        throw new Error(`The resolution note must contain between 1 and ${maxResolutionNoteLength} characters.`);
      }
      await ctx.db.patch(record._id, { status: nextStatus });
      await ctx.db.insert("caseAuditEvents", {
        caseId: record._id,
        actorIdentityId: actor._id,
        actorName,
        occurredAt,
        event: { kind: "case_resolved", from: "work_in_progress", to: "resolved", resolutionNote },
      });
      return { status: nextStatus };
    }
    if (args.action.kind !== "advance") throw new Error("A resolution note is only accepted when resolving a case.");
    await ctx.db.patch(record._id, { status: nextStatus });
    await ctx.db.insert("caseAuditEvents", {
      caseId: record._id,
      actorIdentityId: actor._id,
      actorName,
      occurredAt,
      event: { kind: "status_changed", from: record.status, to: nextStatus },
    });
    return { status: nextStatus };
  },
});
