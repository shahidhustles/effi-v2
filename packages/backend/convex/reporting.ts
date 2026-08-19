import { v } from "convex/values";
import { env, mutation, query } from "./_generated/server";

const channel = v.union(v.literal("telegram"), v.literal("whatsapp"));
const phase = v.union(v.literal("gathering"), v.literal("awaiting_confirmation"), v.literal("authentication_pending"), v.literal("registered"), v.literal("cancelled"));
const draftLifetimeMs = 7 * 24 * 60 * 60 * 1_000;

const serviceSecret = v.string();
const requireGateway = (provided: string): void => {
  if (provided !== env.EFFI_GATEWAY_CONVEX_SECRET) throw new Error("unauthorized gateway request");
};
const claimTokenHash = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const pendingSnapshot = {
  scopeKey: v.string(), channel, conversationId: v.string(), claimToken: v.string(), expiresAt: v.number(), issue: v.string(), category: v.string(),
  location: v.object({ source: v.string(), latitude: v.number(), longitude: v.number() }),
  primaryEvidence: v.array(v.object({ attachmentId: v.string(), storageKey: v.string() })),
};

export const createPendingSubmission = mutation({
  args: { serviceSecret, ...pendingSnapshot },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const existing = await ctx.db.query("pendingSubmissions").withIndex("by_scope_key", (q) => q.eq("scopeKey", args.scopeKey)).first();
    if (existing) return { pendingSubmissionId: existing._id, expiresAt: existing.expiresAt };
    const { serviceSecret: _secret, claimToken, ...submission } = args;
    const pendingSubmissionId = await ctx.db.insert("pendingSubmissions", { ...submission, claimTokenHash: await claimTokenHash(claimToken) });
    return { pendingSubmissionId, expiresAt: args.expiresAt };
  },
});

/** The Clerk JWT, rather than a browser-supplied citizen ID, authorizes this claim. */
export const claimAuthenticatedSubmission = mutation({
  args: { claimToken: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to register this report.");
    const tokenHash = await claimTokenHash(args.claimToken);
    const pending = await ctx.db.query("pendingSubmissions").withIndex("by_claim_token_hash", (q) => q.eq("claimTokenHash", tokenHash)).unique();
    if (!pending) throw new Error("This registration link is invalid.");
    if (pending.claimedReportId) {
      const report = await ctx.db.get(pending.claimedReportId);
      if (!report) throw new Error("This registration link cannot be completed.");
      return { reportNumber: report.reportNumber, channel: report.channel, conversationId: report.conversationId, alreadyClaimed: true };
    }
    if (pending.expiresAt < Date.now()) throw new Error("This registration link has expired.");
    const existingCitizen = await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", identity.tokenIdentifier)).unique();
    const citizenId = existingCitizen?._id ?? await ctx.db.insert("identities", { externalId: identity.tokenIdentifier, role: "citizen" });
    const reportNumber = `RPT-${pending._id}`;
    const reportId = await ctx.db.insert("reports", { pendingSubmissionId: pending._id, citizenId, reportNumber, channel: pending.channel, conversationId: pending.conversationId, issue: pending.issue, category: pending.category, location: pending.location, primaryEvidence: pending.primaryEvidence });
    await ctx.db.insert("cases", { reportId, state: "submitted" });
    await ctx.db.insert("submissionAuditEvents", { pendingSubmissionId: pending._id, reportId, kind: "claimed", occurredAt: Date.now() });
    await ctx.db.patch(pending._id, { claimedReportId: reportId });
    return { reportNumber, channel: pending.channel, conversationId: pending.conversationId, alreadyClaimed: false };
  },
});

export const reserveChannelAcknowledgement = mutation({
  args: { serviceSecret, reportNumber: v.string(), channel, conversationId: v.string() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const report = await ctx.db.query("reports").withIndex("by_report_number", (q) => q.eq("reportNumber", args.reportNumber)).unique();
    if (!report || report.channel !== args.channel || report.conversationId !== args.conversationId) throw new Error("Report acknowledgement does not match its originating conversation.");
    const existing = await ctx.db.query("channelAcknowledgements").withIndex("by_report_id", (q) => q.eq("reportId", report._id)).unique();
    if (existing) return { reserved: false, state: existing.state, reportNumber: report.reportNumber };
    await ctx.db.insert("channelAcknowledgements", { reportId: report._id, channel: report.channel, conversationId: report.conversationId, state: "reserved", reservedAt: Date.now() });
    return { reserved: true, state: "reserved" as const, reportNumber: report.reportNumber };
  },
});

export const recordChannelAcknowledgementOutcome = mutation({
  args: { serviceSecret, reportNumber: v.string(), delivered: v.boolean() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const report = await ctx.db.query("reports").withIndex("by_report_number", (q) => q.eq("reportNumber", args.reportNumber)).unique();
    if (!report) throw new Error("Unknown report acknowledgement.");
    const acknowledgement = await ctx.db.query("channelAcknowledgements").withIndex("by_report_id", (q) => q.eq("reportId", report._id)).unique();
    if (!acknowledgement) throw new Error("Acknowledgement was not reserved.");
    await ctx.db.patch(acknowledgement._id, args.delivered ? { state: "delivered", deliveredAt: Date.now() } : { state: "failed", failedAt: Date.now() });
    return null;
  },
});

export const resumeOrAppendInbound = mutation({
  args: { serviceSecret, scopeKey: v.string(), channel, providerMessageId: v.string(), receivedAt: v.number(), payload: v.any() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const candidates = await ctx.db.query("anonymousReportDrafts")
      .withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey))
      .order("desc").take(1);
    const latest = candidates[0];
    const reusable = latest && latest.lastActivityAt + draftLifetimeMs > args.receivedAt
      && latest.phase !== "registered" && latest.phase !== "cancelled" ? latest : null;
    const draftId = reusable?._id ?? await ctx.db.insert("anonymousReportDrafts", {
      scopeKey: args.scopeKey, channel: args.channel, phase: "gathering", sessionId: crypto.randomUUID(), lastActivityAt: args.receivedAt,
    });
    const existing = await ctx.db.query("anonymousReportMessages")
      .withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draftId).eq("providerMessageId", args.providerMessageId)).unique();
    if (!existing) await ctx.db.insert("anonymousReportMessages", { draftId, providerMessageId: args.providerMessageId, receivedAt: args.receivedAt, payload: args.payload });
    await ctx.db.patch(draftId, { lastActivityAt: args.receivedAt });
    const messages = await ctx.db.query("anonymousReportMessages").withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draftId)).order("asc").take(100);
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new Error("Draft disappeared while resuming.");
    return { duplicate: existing !== null, draft: { phase: draft.phase, sessionId: draft.sessionId }, messages };
  },
});

export const updatePhase = mutation({
  args: { serviceSecret, scopeKey: v.string(), phase, updatedAt: v.number() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = await ctx.db.query("anonymousReportDrafts").withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey)).order("desc").take(1);
    if (!draft[0]) return null;
    await ctx.db.patch(draft[0]._id, { phase: args.phase, lastActivityAt: args.updatedAt });
    return null;
  },
});

export const syncDraftState = mutation({
  args: { serviceSecret, scopeKey: v.string(), phase, updatedAt: v.number(), messages: v.array(v.object({ providerMessageId: v.string(), payload: v.any() })) },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = (await ctx.db.query("anonymousReportDrafts").withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey)).order("desc").take(1))[0];
    if (!draft) throw new Error("No durable draft exists for this conversation.");
    await ctx.db.patch(draft._id, { phase: args.phase, lastActivityAt: args.updatedAt });
    for (const message of args.messages) {
      const stored = await ctx.db.query("anonymousReportMessages").withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draft._id).eq("providerMessageId", message.providerMessageId)).unique();
      if (stored) await ctx.db.patch(stored._id, { payload: message.payload });
    }
    return null;
  },
});

export const loadActive = query({
  args: { serviceSecret, scopeKey: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = (await ctx.db.query("anonymousReportDrafts").withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey)).order("desc").take(1))[0];
    if (!draft || draft.lastActivityAt + draftLifetimeMs <= args.now || draft.phase === "registered" || draft.phase === "cancelled") return null;
    return { phase: draft.phase, sessionId: draft.sessionId, messages: await ctx.db.query("anonymousReportMessages").withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draft._id)).order("asc").take(100) };
  },
});
