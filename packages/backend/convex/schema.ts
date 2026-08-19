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
  }).index("by_draft_id_and_provider_message_id", ["draftId", "providerMessageId"])
});
