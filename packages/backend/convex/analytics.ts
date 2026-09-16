import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  caseAuditEventValidator,
  caseStatusValidator,
  channelValidator,
  exactLocationValidator,
  issueCategoryValidator,
  priorityValidator,
} from "./case_contract";
import { requireOfficer } from "./cases";

const maxAnalyticsCases = 500;

export const getOperationalAnalytics = query({
  args: {},
  returns: v.array(v.object({
    caseId: v.id("cases"),
    reportNumber: v.string(),
    summary: v.string(),
    category: issueCategoryValidator,
    channel: channelValidator,
    status: caseStatusValidator,
    recommendedPriority: priorityValidator,
    currentPriority: priorityValidator,
    submittedAt: v.number(),
    location: exactLocationValidator,
    assignedOfficerName: v.optional(v.string()),
    repostCount: v.number(),
    audit: v.array(v.object({
      occurredAt: v.number(),
      event: caseAuditEventValidator,
    })),
  })),
  handler: async (ctx) => {
    await requireOfficer(ctx);
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_submitted_at")
      .order("desc")
      .take(maxAnalyticsCases);

    return await Promise.all(cases.map(async (record) => {
      const audit = await ctx.db
        .query("caseAuditEvents")
        .withIndex("by_case_id_and_occurred_at", (queryBuilder) => queryBuilder.eq("caseId", record._id))
        .order("asc")
        .collect();

      return {
        caseId: record._id,
        reportNumber: record.reportNumber,
        summary: record.summary,
        category: record.category,
        channel: record.channel,
        status: record.status,
        recommendedPriority: record.recommendedPriority,
        currentPriority: record.currentPriority,
        submittedAt: record.submittedAt,
        location: record.location,
        ...(record.assignedOfficerName ? { assignedOfficerName: record.assignedOfficerName } : {}),
        repostCount: record.repostCount ?? 0,
        audit: audit.map((entry) => ({ occurredAt: entry.occurredAt, event: entry.event })),
      };
    }));
  },
});
