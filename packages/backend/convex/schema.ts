import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  identities: defineTable({
    externalId: v.string(),
    role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin"))
  }).index("by_external_id", ["externalId"]),
  anonymousReportDrafts: defineTable({
    scopeKey: v.string(),
    channel: v.union(v.literal("telegram"), v.literal("whatsapp")),
    phase: v.union(
      v.literal("gathering"),
      v.literal("awaiting_confirmation"),
      v.literal("authentication_pending"),
      v.literal("registered"),
      v.literal("cancelled"),
    ),
    sessionId: v.string(),
    lastActivityAt: v.number(),
  }).index("by_scope_key_and_last_activity_at", ["scopeKey", "lastActivityAt"]),
  anonymousReportMessages: defineTable({
    draftId: v.id("anonymousReportDrafts"),
    providerMessageId: v.string(),
    receivedAt: v.number(),
    payload: v.any(),
  }).index("by_draft_id_and_provider_message_id", ["draftId", "providerMessageId"]),
  pendingSubmissions: defineTable({
    claimTokenHash: v.string(), scopeKey: v.string(), channel: v.union(v.literal("telegram"), v.literal("whatsapp")), conversationId: v.string(),
    expiresAt: v.number(), claimedReportId: v.optional(v.id("reports")), issue: v.string(), category: v.string(),
    location: v.object({ source: v.string(), latitude: v.number(), longitude: v.number() }),
    primaryEvidence: v.array(v.object({ attachmentId: v.string(), storageKey: v.string() })),
  }).index("by_claim_token_hash", ["claimTokenHash"]).index("by_scope_key", ["scopeKey"]),
  reports: defineTable({ pendingSubmissionId: v.id("pendingSubmissions"), citizenId: v.id("identities"), reportNumber: v.string(), channel: v.union(v.literal("telegram"), v.literal("whatsapp")), conversationId: v.string(), issue: v.string(), category: v.string(), location: v.object({ source: v.string(), latitude: v.number(), longitude: v.number() }), primaryEvidence: v.array(v.object({ attachmentId: v.string(), storageKey: v.string() })) }).index("by_pending_submission_id", ["pendingSubmissionId"]),
  cases: defineTable({ reportId: v.id("reports"), state: v.literal("submitted") }).index("by_report_id", ["reportId"]),
  submissionAuditEvents: defineTable({ pendingSubmissionId: v.id("pendingSubmissions"), reportId: v.id("reports"), kind: v.literal("claimed"), occurredAt: v.number() }).index("by_pending_submission_id", ["pendingSubmissionId"])
});
