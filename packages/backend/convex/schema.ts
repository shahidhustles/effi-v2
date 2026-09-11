import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  acceptedEvidenceValidator,
  anonymousTranscriptPayloadValidator,
  caseBriefValidator,
  caseStatusValidator,
  caseTranscriptContentValidator,
  channelValidator,
  exactLocationValidator,
  issueCategoryValidator,
  priorityValidator,
  sourceCitationValidator,
} from "./case_contract";

export default defineSchema({
  identities: defineTable({
    externalId: v.string(),
    role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin")),
  }).index("by_external_id", ["externalId"]),
  anonymousReportDrafts: defineTable({
    scopeKey: v.string(),
    channel: channelValidator,
    phase: v.union(
      v.literal("gathering"),
      v.literal("awaiting_confirmation"),
      v.literal("authentication_pending"),
      v.literal("registered"),
      v.literal("cancelled"),
    ),
    sessionId: v.string(),
    lastActivityAt: v.number(),
    nextMessageSequence: v.number(),
  }).index("by_scope_key_and_last_activity_at", ["scopeKey", "lastActivityAt"])
    .index("by_phase_and_last_activity_at", ["phase", "lastActivityAt"]),
  anonymousReportMessages: defineTable({
    draftId: v.id("anonymousReportDrafts"),
    providerMessageId: v.string(),
    receivedAt: v.number(),
    sequence: v.number(),
    direction: v.union(v.literal("citizen"), v.literal("effi")),
    payload: anonymousTranscriptPayloadValidator,
  }).index("by_draft_id_and_provider_message_id", ["draftId", "providerMessageId"])
    .index("by_draft_id_and_sequence", ["draftId", "sequence"]),
  pendingSubmissions: defineTable({
    draftId: v.optional(v.id("anonymousReportDrafts")),
    claimTokenHash: v.string(),
    scopeKey: v.string(),
    channel: channelValidator,
    conversationId: v.string(),
    expiresAt: v.number(),
    claimedReportId: v.optional(v.id("reports")),
    issue: v.string(),
    category: issueCategoryValidator,
    location: exactLocationValidator,
    primaryEvidence: v.array(acceptedEvidenceValidator),
    reportedAt: v.number(),
    caseBrief: caseBriefValidator,
  }).index("by_claim_token_hash", ["claimTokenHash"])
    .index("by_scope_key", ["scopeKey"])
    .index("by_draft_id", ["draftId"]),
  reports: defineTable({
    pendingSubmissionId: v.id("pendingSubmissions"),
    citizenId: v.id("identities"),
    reportNumber: v.string(),
    channel: channelValidator,
    conversationId: v.string(),
    issue: v.string(),
    category: issueCategoryValidator,
    location: exactLocationValidator,
    primaryEvidence: v.array(acceptedEvidenceValidator),
    reportedAt: v.number(),
    submittedAt: v.number(),
  }).index("by_pending_submission_id", ["pendingSubmissionId"])
    .index("by_report_number", ["reportNumber"]),
  cases: defineTable({
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
    acceptedEvidence: v.array(acceptedEvidenceValidator),
    channel: channelValidator,
    conversationId: v.string(),
    status: caseStatusValidator,
    assignedOfficerId: v.optional(v.id("identities")),
  }).index("by_report_id", ["reportId"])
    .index("by_submitted_at", ["submittedAt"])
    .index("by_status_and_submitted_at", ["status", "submittedAt"])
    .index("by_current_priority_and_submitted_at", ["currentPriority", "submittedAt"]),
  caseTranscriptMessages: defineTable({
    caseId: v.id("cases"),
    sourceMessageId: v.string(),
    sequence: v.number(),
    direction: v.union(v.literal("citizen"), v.literal("effi")),
    occurredAt: v.number(),
    content: caseTranscriptContentValidator,
  }).index("by_case_id_and_sequence", ["caseId", "sequence"]),
  submissionAuditEvents: defineTable({
    pendingSubmissionId: v.id("pendingSubmissions"),
    reportId: v.id("reports"),
    kind: v.literal("claimed"),
    occurredAt: v.number(),
  }).index("by_pending_submission_id", ["pendingSubmissionId"]),
  channelAcknowledgements: defineTable({
    reportId: v.id("reports"),
    channel: channelValidator,
    conversationId: v.string(),
    state: v.union(v.literal("reserved"), v.literal("delivered"), v.literal("failed")),
    reservedAt: v.number(),
    deliveredAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  }).index("by_report_id", ["reportId"]),
});
