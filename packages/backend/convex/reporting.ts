import { v } from "convex/values";
import { env, mutation, query } from "./_generated/server";

const channel = v.union(v.literal("telegram"), v.literal("whatsapp"));
const phase = v.union(v.literal("gathering"), v.literal("awaiting_confirmation"), v.literal("authentication_pending"), v.literal("registered"), v.literal("cancelled"));
const draftLifetimeMs = 7 * 24 * 60 * 60 * 1_000;

const serviceSecret = v.string();
const requireGateway = (provided: string): void => {
  if (provided !== env.EFFI_GATEWAY_CONVEX_SECRET) throw new Error("unauthorized gateway request");
};

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
