import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  caseStatusValidator,
  channelValidator,
  exactLocationValidator,
  issueCategoryValidator,
  priorityValidator,
} from "./case_contract";

const accountValidator = v.object({
  role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin")),
  joinedAt: v.number(),
});

const viewerCaseValidator = v.object({
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
  location: exactLocationValidator,
});

const citizenTimelineEntryValidator = v.object({
  id: v.string(),
  actorName: v.string(),
  occurredAt: v.number(),
  event: v.union(
    v.object({ kind: v.literal("registered") }),
    v.object({ kind: v.literal("assigned") }),
    v.object({
      kind: v.literal("priority_changed"),
      from: priorityValidator,
      to: priorityValidator,
    }),
    v.object({
      kind: v.literal("status_changed"),
      from: caseStatusValidator,
      to: caseStatusValidator,
    }),
    v.object({
      kind: v.literal("resolved"),
      from: v.literal("work_in_progress"),
      to: v.literal("resolved"),
      resolutionNote: v.string(),
    }),
  ),
});

const maxViewerCases = 50;

type Account = { role: "citizen" | "officer" | "admin"; joinedAt: number };

type CitizenTimelineEntry = {
  id: string;
  actorName: string;
  occurredAt: number;
  event:
    | { kind: "registered" }
    | { kind: "assigned" }
    | {
        kind: "priority_changed";
        from: "critical" | "high" | "medium" | "low";
        to: "critical" | "high" | "medium" | "low";
      }
    | {
        kind: "status_changed";
        from:
          | "new"
          | "assigned"
          | "under_inspection"
          | "work_in_progress"
          | "resolved";
        to:
          | "new"
          | "assigned"
          | "under_inspection"
          | "work_in_progress"
          | "resolved";
      }
    | {
        kind: "resolved";
        from: "work_in_progress";
        to: "resolved";
        resolutionNote: string;
      };
};

const toAccount = (identity: Doc<"identities">): Account => ({
  role: identity.role,
  joinedAt: identity._creationTime,
});

const findAccount = async (ctx: QueryCtx | MutationCtx, externalId: string) =>
  ctx.db
    .query("identities")
    .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
    .unique();

/** Any signed-in Clerk account can become a citizen; the token decides who. */
const getOrCreateAccount = async (
  ctx: MutationCtx,
): Promise<Doc<"identities">> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in to use the citizen app.");
  const existing = await findAccount(ctx, identity.tokenIdentifier);
  if (existing) return existing;
  const identityId = await ctx.db.insert("identities", {
    externalId: identity.tokenIdentifier,
    role: "citizen",
  });
  const created = await ctx.db.get(identityId);
  if (!created) throw new Error("The citizen account could not be created.");
  return created;
};

/** Creates the citizen record once per Clerk account; later calls return the existing record. */
export const ensureCitizen = mutation({
  args: {},
  returns: accountValidator,
  handler: async (ctx) => toAccount(await getOrCreateAccount(ctx)),
});

/** Account state comes from the Clerk token, never from a client-supplied identifier. */
export const viewer = query({
  args: {},
  returns: v.union(accountValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const account = await findAccount(ctx, identity.tokenIdentifier);
    return account ? toAccount(account) : null;
  },
});

const findViewerAccount = async (
  ctx: QueryCtx,
): Promise<Doc<"identities"> | null> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await findAccount(ctx, identity.tokenIdentifier);
};

/** Only the signed-in citizen's own reports, newest first. */
export const viewerCases = query({
  args: {},
  returns: v.array(viewerCaseValidator),
  handler: async (ctx) => {
    const account = await findViewerAccount(ctx);
    if (!account) return [];
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_citizen_id", (q) => q.eq("citizenId", account._id))
      .order("desc")
      .take(maxViewerCases);
    const cases = await Promise.all(
      reports.map(async (report) => {
        const record = await ctx.db
          .query("cases")
          .withIndex("by_report_id", (q) => q.eq("reportId", report._id))
          .unique();
        if (!record) return null;
        return {
          caseId: record._id,
          reportId: report._id,
          reportNumber: record.reportNumber,
          summary: record.summary,
          category: record.category,
          status: record.status,
          currentPriority: record.currentPriority,
          reportedAt: record.reportedAt,
          submittedAt: record.submittedAt,
          channel: record.channel,
          location: record.location,
        };
      }),
    );
    return cases.filter(
      (entry): entry is NonNullable<typeof entry> => entry !== null,
    );
  },
});

/** The signed-in citizen's complete case history, fetched a page at a time. */
export const viewerCaseHistory = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const account = await findViewerAccount(ctx);
    if (!account) return { page: [], isDone: true, continueCursor: "" };
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_citizen_id", (q) => q.eq("citizenId", account._id))
      .order("desc")
      .paginate(args.paginationOpts);
    const cases = await Promise.all(
      reports.page.map(async (report) => {
        const record = await ctx.db
          .query("cases")
          .withIndex("by_report_id", (q) => q.eq("reportId", report._id))
          .unique();
        if (!record) return null;
        return {
          caseId: record._id,
          reportId: report._id,
          reportNumber: record.reportNumber,
          summary: record.summary,
          category: record.category,
          status: record.status,
          currentPriority: record.currentPriority,
          reportedAt: record.reportedAt,
          submittedAt: record.submittedAt,
          channel: record.channel,
          location: record.location,
        };
      }),
    );
    return {
      ...reports,
      page: cases.filter(
        (entry): entry is NonNullable<typeof entry> => entry !== null,
      ),
    };
  },
});

/** A case is readable only through the citizen's own report, never by case id alone. */
export const viewerCase = query({
  args: { caseId: v.id("cases") },
  returns: v.union(
    v.null(),
    v.object({
      case: v.object({
        caseId: v.id("cases"),
        reportId: v.id("reports"),
        reportNumber: v.string(),
        summary: v.string(),
        category: issueCategoryValidator,
        status: caseStatusValidator,
        location: exactLocationValidator,
        submittedAt: v.number(),
      }),
      evidence: v.array(
        v.object({
          attachmentId: v.string(),
          mediaType: v.string(),
          url: v.union(v.string(), v.null()),
        }),
      ),
      timeline: v.array(citizenTimelineEntryValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const account = await findViewerAccount(ctx);
    if (!account) return null;
    const record = await ctx.db.get(args.caseId);
    if (!record) return null;
    const report = await ctx.db.get(record.reportId);
    if (!report || report.citizenId !== account._id) return null;
    const evidence = await Promise.all(
      record.acceptedEvidence.map(async (entry) => ({
        attachmentId: entry.attachmentId,
        mediaType: entry.mediaType,
        url: entry.storageId ? await ctx.storage.getUrl(entry.storageId) : null,
      })),
    );
    const audit = await ctx.db
      .query("caseAuditEvents")
      .withIndex("by_case_id_and_occurred_at", (q) =>
        q.eq("caseId", record._id),
      )
      .order("asc")
      .collect();
    const assignmentTimes = new Set(
      audit
        .filter((entry) => entry.event.kind === "case_assigned")
        .map((entry) => entry.occurredAt),
    );
    const timeline: CitizenTimelineEntry[] = [
      {
        id: `${record._id}:registered`,
        actorName: "Effi",
        occurredAt: record.submittedAt,
        event: { kind: "registered" },
      },
    ];
    for (const entry of audit) {
      const event = entry.event;
      switch (event.kind) {
        case "case_assigned":
          timeline.push({
            id: entry._id,
            actorName: entry.actorName,
            occurredAt: entry.occurredAt,
            event: { kind: "assigned" },
          });
          break;
        case "priority_changed":
          timeline.push({
            id: entry._id,
            actorName: entry.actorName,
            occurredAt: entry.occurredAt,
            event,
          });
          break;
        case "status_changed":
          if (
            event.from === "new" &&
            event.to === "assigned" &&
            assignmentTimes.has(entry.occurredAt)
          )
            break;
          timeline.push({
            id: entry._id,
            actorName: entry.actorName,
            occurredAt: entry.occurredAt,
            event,
          });
          break;
        case "case_resolved":
          timeline.push({
            id: entry._id,
            actorName: entry.actorName,
            occurredAt: entry.occurredAt,
            event: {
              kind: "resolved",
              from: event.from,
              to: event.to,
              resolutionNote: event.resolutionNote,
            },
          });
          break;
        default: {
          const unhandled: never = event;
          return unhandled;
        }
      }
    }
    return {
      case: {
        caseId: record._id,
        reportId: record.reportId,
        reportNumber: record.reportNumber,
        summary: record.summary,
        category: record.category,
        status: record.status,
        location: record.location,
        submittedAt: record.submittedAt,
      },
      evidence,
      timeline,
    };
  },
});
