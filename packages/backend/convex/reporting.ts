import { v, type Infer } from "convex/values";
import { env, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  acceptedEvidenceValidator,
  anonymousTranscriptPayloadValidator,
  caseBriefValidator,
  channelValidator,
  exactLocationValidator,
  issueCategoryValidator,
} from "./case_contract";
import { anonymousDraftLifetimeMs, isAnonymousDraftExpired } from "./reporting_lifecycle";

const channel = channelValidator;
const phase = v.union(v.literal("gathering"), v.literal("awaiting_confirmation"), v.literal("authentication_pending"), v.literal("registered"), v.literal("cancelled"));
const expirationBatchSize = 64;
const expirablePhases = ["gathering", "awaiting_confirmation", "authentication_pending", "cancelled"] as const;

const serviceSecret = v.string();
const requireGateway = (provided: string): void => {
  if (provided !== env.EFFI_GATEWAY_CONVEX_SECRET) throw new Error("unauthorized gateway request");
};
const claimTokenHash = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
const pendingSnapshot = {
  scopeKey: v.string(), channel, conversationId: v.string(), claimToken: v.string(), expiresAt: v.number(), issue: v.string(), category: issueCategoryValidator,
  location: exactLocationValidator,
  primaryEvidence: v.array(acceptedEvidenceValidator),
  caseBrief: caseBriefValidator,
};
const effiTranscriptSource = v.union(v.literal("assistant_message"), v.literal("input_request"));
const transcriptInputRequest = v.object({
  requestId: v.string(),
  prompt: v.string(),
  options: v.array(v.object({ id: v.string(), label: v.string() })),
  allowFreeform: v.boolean(),
});
const maxTranscriptMessages = 100;
const maxAcceptedEvidence = 10;

const hasText = (value: string): boolean => value.trim().length > 0;
const assertExactLocation = (location: { latitude: number; longitude: number }): void => {
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new Error("The confirmed latitude is invalid.");
  }
  if (!Number.isFinite(location.longitude) || location.longitude < -180 || location.longitude > 180) {
    throw new Error("The confirmed longitude is invalid.");
  }
};

const normalizedTranscript = (
  messages: readonly Doc<"anonymousReportMessages">[],
  acceptedEvidenceIds: ReadonlySet<string>,
) => messages.map((message) => {
  if (message.direction === "citizen") {
    if (!("id" in message.payload)) throw new Error("A citizen transcript entry has invalid content.");
    const payload = message.payload;
    const attachments = (payload.attachments ?? []).map((attachment) => {
      if (!attachment.storageKey || !hasText(attachment.mediaType)) {
        throw new Error("A transcript attachment is missing durable metadata.");
      }
      return {
        attachmentId: attachment.id,
        storageKey: attachment.storageKey,
        mediaType: attachment.mediaType,
        accepted: acceptedEvidenceIds.has(attachment.id),
      };
    });
    const hasCitizenContent = Boolean(
      payload.text?.trim()
      || payload.voiceTranscript?.trim()
      || payload.action
      || payload.location
      || attachments.length,
    );
    if (!hasCitizenContent) throw new Error("A citizen transcript entry has no supported content.");
    return {
      sourceMessageId: message.providerMessageId,
      sequence: message.sequence,
      direction: message.direction,
      occurredAt: message.receivedAt,
      content: {
        kind: "citizen_message" as const,
        ...(payload.text === undefined ? {} : { text: payload.text }),
        ...(payload.voiceTranscript === undefined ? {} : { voiceTranscript: payload.voiceTranscript }),
        ...(payload.action === undefined ? {} : { action: payload.action }),
        ...(payload.location === undefined ? {} : { location: payload.location }),
        attachments,
      },
    };
  }

  if (!("role" in message.payload) || !hasText(message.payload.text)) {
    throw new Error("An Effi transcript entry has invalid content.");
  }
  const payload = message.payload;
  if (payload.source === "input_request") {
    if (!payload.inputRequest || !hasText(payload.inputRequest.prompt) || payload.inputRequest.options.length === 0) {
      throw new Error("An Effi input request is incomplete.");
    }
    return {
      sourceMessageId: message.providerMessageId,
      sequence: message.sequence,
      direction: message.direction,
      occurredAt: message.receivedAt,
      content: {
        kind: "input_request" as const,
        text: payload.text,
        requestId: payload.inputRequest.requestId,
        prompt: payload.inputRequest.prompt,
        options: payload.inputRequest.options,
        allowFreeform: payload.inputRequest.allowFreeform,
      },
    };
  }
  if (payload.inputRequest) throw new Error("An Effi message has unexpected input-request metadata.");
  return {
    sourceMessageId: message.providerMessageId,
    sequence: message.sequence,
    direction: message.direction,
    occurredAt: message.receivedAt,
    content: { kind: "effi_message" as const, text: payload.text },
  };
});

const validateTranscriptOrder = (messages: readonly Doc<"anonymousReportMessages">[]): void => {
  if (messages.length === 0) throw new Error("A pending submission requires a persisted transcript.");
  if (messages.length > maxTranscriptMessages) throw new Error("The report transcript is too long to submit.");
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.sequence !== index) throw new Error("The report transcript sequence is invalid.");
  }
};

const validateBrief = (
  brief: Infer<typeof caseBriefValidator>,
  category: Infer<typeof issueCategoryValidator>,
  transcriptMessageIds: ReadonlySet<string>,
  acceptedEvidenceIds: ReadonlySet<string>,
): void => {
  if (!hasText(brief.summary) || brief.summary.length > 280) throw new Error("The case summary is invalid.");
  if (brief.category !== category) throw new Error("The case brief category must match the confirmed category.");
  if (brief.priority.reasons.length === 0 || brief.priority.reasons.length > 5 || brief.priority.reasons.some((reason) => !hasText(reason))) {
    throw new Error("The priority recommendation requires valid reasons.");
  }
  if (brief.citations.length === 0 || brief.citations.length > 10) throw new Error("The case brief requires source citations.");
  for (const citation of brief.citations) {
    if (!hasText(citation.explanation)) throw new Error("Every case citation requires an explanation.");
    if (citation.kind === "transcript_message" && !transcriptMessageIds.has(citation.sourceMessageId)) {
      throw new Error("The case brief cites a transcript message outside this report.");
    }
    if (citation.kind === "accepted_evidence" && !acceptedEvidenceIds.has(citation.attachmentId)) {
      throw new Error("The case brief cites evidence that was not accepted.");
    }
  }
};

export const createPendingSubmission = mutation({
  args: { serviceSecret, ...pendingSnapshot },
  returns: v.object({ pendingSubmissionId: v.id("pendingSubmissions"), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    assertExactLocation(args.location);
    const draft = (await ctx.db.query("anonymousReportDrafts")
      .withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey))
      .order("desc")
      .take(1))[0];
    if (!draft || draft.phase === "cancelled" || draft.phase === "registered") {
      throw new Error("No active anonymous draft exists for this pending submission.");
    }
    if (draft.channel !== args.channel) throw new Error("The pending submission channel does not match its draft.");
    const existing = await ctx.db.query("pendingSubmissions").withIndex("by_draft_id", (q) => q.eq("draftId", draft._id)).unique();
    if (existing) return { pendingSubmissionId: existing._id, expiresAt: existing.expiresAt };
    const messages = await ctx.db.query("anonymousReportMessages")
      .withIndex("by_draft_id_and_sequence", (q) => q.eq("draftId", draft._id))
      .order("asc")
      .take(maxTranscriptMessages + 1);
    validateTranscriptOrder(messages);
    const firstCitizenMessage = messages.find((message) => message.direction === "citizen");
    if (!firstCitizenMessage) throw new Error("The report transcript has no citizen message.");
    const transcriptMessageIds = new Set(messages.map((message) => message.providerMessageId));
    if (transcriptMessageIds.size !== messages.length) throw new Error("The report transcript contains duplicate source messages.");
    for (const message of messages) {
      if (message.direction !== "citizen" || !("id" in message.payload)) continue;
      if (message.payload.channel !== args.channel || message.payload.conversationId !== args.conversationId) {
        throw new Error("A transcript message belongs to a different conversation.");
      }
    }
    const locationIsPersisted = messages.some((message) => message.direction === "citizen"
      && "id" in message.payload
      && message.payload.location?.source === args.location.source
      && message.payload.location.latitude === args.location.latitude
      && message.payload.location.longitude === args.location.longitude);
    if (!locationIsPersisted) throw new Error("The confirmed location is not present in the transcript.");
    if (args.primaryEvidence.length === 0 || args.primaryEvidence.length > maxAcceptedEvidence) {
      throw new Error("A pending submission requires between one and ten accepted evidence items.");
    }
    const acceptedEvidenceIds = new Set(args.primaryEvidence.map((evidence) => evidence.attachmentId));
    if (acceptedEvidenceIds.size !== args.primaryEvidence.length) throw new Error("Accepted evidence IDs must be unique.");
    for (const evidence of args.primaryEvidence) {
      const sourceMessage = messages.find((message) => message.providerMessageId === evidence.sourceMessageId);
      if (!sourceMessage || sourceMessage.direction !== "citizen" || !("id" in sourceMessage.payload)) {
        throw new Error("Accepted evidence must reference a citizen transcript message.");
      }
      const attachment = sourceMessage.payload.attachments?.find((candidate) => candidate.id === evidence.attachmentId);
      if (
        !attachment
        || attachment.kind !== "image"
        || attachment.inspected !== true
        || attachment.quality !== "satisfactory"
        || attachment.storageKey !== evidence.storageKey
        || attachment.mediaType !== evidence.mediaType
      ) {
        throw new Error("Accepted evidence metadata does not match the inspected transcript attachment.");
      }
    }
    validateBrief(args.caseBrief, args.category, transcriptMessageIds, acceptedEvidenceIds);
    normalizedTranscript(messages, acceptedEvidenceIds);
    const pendingSubmissionId = await ctx.db.insert("pendingSubmissions", {
      claimTokenHash: await claimTokenHash(args.claimToken),
      draftId: draft._id,
      scopeKey: args.scopeKey,
      channel: args.channel,
      conversationId: args.conversationId,
      expiresAt: args.expiresAt,
      issue: args.issue,
      category: args.category,
      location: args.location,
      primaryEvidence: args.primaryEvidence,
      reportedAt: firstCitizenMessage.receivedAt,
      caseBrief: args.caseBrief,
    });
    return { pendingSubmissionId, expiresAt: args.expiresAt };
  },
});

/** The Clerk JWT, rather than a browser-supplied citizen ID, authorizes this claim. */
export const claimAuthenticatedSubmission = mutation({
  args: { claimToken: v.string() },
  returns: v.object({
    reportNumber: v.string(),
    channel,
    conversationId: v.string(),
    alreadyClaimed: v.boolean(),
  }),
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
    if (pending.expiresAt <= Date.now()) throw new Error("This registration link has expired.");
    if (!pending.draftId) throw new Error("This registration link does not contain a dashboard-ready report.");
    const draftId = pending.draftId;
    const acceptedEvidence = pending.primaryEvidence.map((evidence) => ({ ...evidence }));
    const messages = await ctx.db.query("anonymousReportMessages")
      .withIndex("by_draft_id_and_sequence", (q) => q.eq("draftId", draftId))
      .order("asc")
      .take(maxTranscriptMessages + 1);
    validateTranscriptOrder(messages);
    const acceptedEvidenceIds = new Set(acceptedEvidence.map((evidence) => evidence.attachmentId));
    const transcript = normalizedTranscript(messages, acceptedEvidenceIds);
    validateBrief(
      pending.caseBrief,
      pending.category,
      new Set(messages.map((message) => message.providerMessageId)),
      acceptedEvidenceIds,
    );
    const existingCitizen = await ctx.db.query("identities").withIndex("by_external_id", (q) => q.eq("externalId", identity.tokenIdentifier)).unique();
    const citizenId = existingCitizen?._id ?? await ctx.db.insert("identities", { externalId: identity.tokenIdentifier, role: "citizen" });
    const reportNumber = `RPT-${pending._id}`;
    const submittedAt = Date.now();
    const reportId = await ctx.db.insert("reports", {
      pendingSubmissionId: pending._id,
      citizenId,
      reportNumber,
      channel: pending.channel,
      conversationId: pending.conversationId,
      issue: pending.issue,
      category: pending.category,
      location: pending.location,
      primaryEvidence: acceptedEvidence,
      reportedAt: pending.reportedAt,
      submittedAt,
    });
    const caseId = await ctx.db.insert("cases", {
      reportId,
      reportNumber,
      summary: pending.caseBrief.summary,
      category: pending.category,
      location: pending.location,
      reportedAt: pending.reportedAt,
      submittedAt,
      recommendedPriority: pending.caseBrief.priority.priority,
      currentPriority: pending.caseBrief.priority.priority,
      priorityReasons: pending.caseBrief.priority.reasons,
      citations: pending.caseBrief.citations,
      acceptedEvidence,
      channel: pending.channel,
      conversationId: pending.conversationId,
      status: "new",
    });
    for (const message of transcript) await ctx.db.insert("caseTranscriptMessages", { caseId, ...message });
    await ctx.db.insert("submissionAuditEvents", { pendingSubmissionId: pending._id, reportId, kind: "claimed", occurredAt: submittedAt });
    await ctx.db.patch(pending._id, { claimedReportId: reportId });
    await ctx.db.patch(draftId, { phase: "registered", lastActivityAt: submittedAt });
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
  args: { serviceSecret, scopeKey: v.string(), channel, providerMessageId: v.string(), receivedAt: v.number(), payload: anonymousTranscriptPayloadValidator },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const candidates = await ctx.db.query("anonymousReportDrafts")
      .withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey))
      .order("desc").take(1);
    const latest = candidates[0];
    const reusable = latest && !isAnonymousDraftExpired(latest.lastActivityAt, args.receivedAt)
      && latest.phase !== "registered" && latest.phase !== "cancelled" ? latest : null;
    const draftId = reusable?._id ?? await ctx.db.insert("anonymousReportDrafts", {
      scopeKey: args.scopeKey, channel: args.channel, phase: "gathering", sessionId: crypto.randomUUID(), lastActivityAt: args.receivedAt,
      nextMessageSequence: 0,
    });
    const draftBeforeAppend = await ctx.db.get(draftId);
    if (!draftBeforeAppend) throw new Error("Draft disappeared while appending a citizen message.");
    const existing = await ctx.db.query("anonymousReportMessages")
      .withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draftId).eq("providerMessageId", args.providerMessageId)).unique();
    if (!existing) {
      await ctx.db.insert("anonymousReportMessages", {
        draftId,
        providerMessageId: args.providerMessageId,
        receivedAt: args.receivedAt,
        sequence: draftBeforeAppend.nextMessageSequence,
        direction: "citizen",
        payload: args.payload,
      });
      await ctx.db.patch(draftId, {
        lastActivityAt: args.receivedAt,
        nextMessageSequence: draftBeforeAppend.nextMessageSequence + 1,
      });
    } else {
      await ctx.db.patch(draftId, { lastActivityAt: args.receivedAt });
    }
    const messages = await ctx.db.query("anonymousReportMessages").withIndex("by_draft_id_and_sequence", (q) => q.eq("draftId", draftId)).order("asc").take(100);
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new Error("Draft disappeared while resuming.");
    return { duplicate: existing !== null, draft: { phase: draft.phase, sessionId: draft.sessionId }, messages };
  },
});

export const appendEffiTranscriptMessage = mutation({
  args: {
    serviceSecret,
    scopeKey: v.string(),
    eventId: v.string(),
    occurredAt: v.number(),
    text: v.string(),
    source: effiTranscriptSource,
    inputRequest: v.optional(transcriptInputRequest),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = (await ctx.db.query("anonymousReportDrafts")
      .withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey))
      .order("desc")
      .take(1))[0];
    if (!draft || draft.phase === "cancelled") return false;
    const existing = await ctx.db.query("anonymousReportMessages")
      .withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draft._id).eq("providerMessageId", args.eventId))
      .unique();
    if (existing) return true;
    await ctx.db.insert("anonymousReportMessages", {
      draftId: draft._id,
      providerMessageId: args.eventId,
      receivedAt: args.occurredAt,
      sequence: draft.nextMessageSequence,
      direction: "effi",
      payload: {
        role: "assistant",
        text: args.text,
        source: args.source,
        ...(args.inputRequest ? { inputRequest: args.inputRequest } : {}),
      },
    });
    await ctx.db.patch(draft._id, {
      lastActivityAt: Math.max(draft.lastActivityAt, args.occurredAt),
      nextMessageSequence: draft.nextMessageSequence + 1,
    });
    return true;
  },
});

/** The gateway, not the model, decides when a citizen abandons a draft. */
export const cancelActiveDraft = mutation({
  args: { serviceSecret, scopeKey: v.string(), cancelledAt: v.number() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = (await ctx.db.query("anonymousReportDrafts")
      .withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey))
      .order("desc")
      .take(1))[0];
    if (!draft || draft.phase === "registered" || draft.phase === "cancelled") return false;
    await ctx.db.patch(draft._id, { phase: "cancelled", lastActivityAt: args.cancelledAt });
    const pending = await ctx.db.query("pendingSubmissions").withIndex("by_draft_id", (q) => q.eq("draftId", draft._id)).unique();
    if (pending && !pending.claimedReportId) await ctx.db.delete(pending._id);
    return true;
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
  args: { serviceSecret, scopeKey: v.string(), sessionId: v.string(), phase, updatedAt: v.number(), messages: v.array(v.object({ providerMessageId: v.string(), payload: anonymousTranscriptPayloadValidator })) },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = (await ctx.db.query("anonymousReportDrafts").withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey)).order("desc").take(1))[0];
    if (!draft || draft.sessionId !== args.sessionId || draft.phase === "cancelled" || draft.phase === "registered") {
      throw new Error("The durable draft is no longer active for this conversation.");
    }
    await ctx.db.patch(draft._id, { phase: args.phase, lastActivityAt: args.updatedAt });
    for (const message of args.messages) {
      const stored = await ctx.db.query("anonymousReportMessages").withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draft._id).eq("providerMessageId", message.providerMessageId)).unique();
      if (stored) await ctx.db.patch(stored._id, { payload: message.payload });
    }
    return null;
  },
});

const mediaKeysInPayload = (payload: unknown): string[] => {
  if (typeof payload !== "object" || payload === null) return [];
  const message = payload as { attachments?: unknown; voice?: unknown };
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const attachmentKeys = attachments.flatMap((attachment) => {
    if (typeof attachment !== "object" || attachment === null) return [];
    const storageKey = (attachment as { storageKey?: unknown }).storageKey;
    return typeof storageKey === "string" ? [storageKey] : [];
  });
  const voiceKey = typeof message.voice === "object" && message.voice !== null
    ? (message.voice as { storageKey?: unknown }).storageKey : undefined;
  return typeof voiceKey === "string" ? [...attachmentKeys, voiceKey] : attachmentKeys;
};

/** Selects a bounded anonymous batch; the action only finalizes it after gateway media deletion succeeds. */
export const prepareExpiredAnonymousDraftErasure = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expiresBefore = Date.now() - anonymousDraftLifetimeMs;
    const candidates = await Promise.all(expirablePhases.map(async (draftPhase) => (
      await ctx.db.query("anonymousReportDrafts")
        .withIndex("by_phase_and_last_activity_at", (q) => q.eq("phase", draftPhase).lt("lastActivityAt", expiresBefore))
        .take(1)
    )));
    const draft = candidates.flat().sort((left, right) => left.lastActivityAt - right.lastActivityAt)[0];
    if (!draft) return null;
    const messages = await ctx.db.query("anonymousReportMessages")
      .withIndex("by_draft_id_and_provider_message_id", (q) => q.eq("draftId", draft._id))
      .take(expirationBatchSize + 1);
    const batch = messages.slice(0, expirationBatchSize);
    const isFinalBatch = messages.length <= expirationBatchSize;
    const pending = isFinalBatch
      ? await ctx.db.query("pendingSubmissions").withIndex("by_draft_id", (q) => q.eq("draftId", draft._id)).unique()
      : null;
    return {
      draftId: draft._id,
      messageIds: batch.map((message) => message._id),
      storageKeys: [...new Set(batch.flatMap((message) => mediaKeysInPayload(message.payload)))],
      isFinalBatch,
      ...(pending && !pending.claimedReportId ? {
        notification: { channel: pending.channel, conversationId: pending.conversationId },
      } : {}),
    };
  },
});

export const finalizeExpiredAnonymousDraftErasure = internalMutation({
  args: { draftId: v.id("anonymousReportDrafts"), messageIds: v.array(v.id("anonymousReportMessages")), isFinalBatch: v.boolean() },
  handler: async (ctx, args) => {
    for (const messageId of args.messageIds) await ctx.db.delete(messageId);
    if (!args.isFinalBatch) return false;
    const pending = await ctx.db.query("pendingSubmissions").withIndex("by_draft_id", (q) => q.eq("draftId", args.draftId)).unique();
    if (pending && !pending.claimedReportId) await ctx.db.delete(pending._id);
    await ctx.db.delete(args.draftId);
    return true;
  },
});

export const eraseExpiredAnonymousDrafts = internalAction({
  args: {},
  handler: async (ctx) => {
    const batch = await ctx.runMutation(internal.reporting!.prepareExpiredAnonymousDraftErasure!, {});
    if (!batch) return null;
    const response = await fetch(env.EFFI_GATEWAY_MEDIA_ERASURE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-effi-media-erasure-secret": env.EFFI_GATEWAY_CONVEX_SECRET },
      body: JSON.stringify({ storageKeys: batch.storageKeys }),
    });
    if (!response.ok) throw new Error("The bot gateway did not erase anonymous draft media.");
    await ctx.runMutation(internal.reporting!.finalizeExpiredAnonymousDraftErasure!, batch);
    await ctx.scheduler.runAfter(0, internal.reporting!.eraseExpiredAnonymousDrafts!, {});
    return null;
  },
});

export const loadActive = query({
  args: { serviceSecret, scopeKey: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    requireGateway(args.serviceSecret);
    const draft = (await ctx.db.query("anonymousReportDrafts").withIndex("by_scope_key_and_last_activity_at", (q) => q.eq("scopeKey", args.scopeKey)).order("desc").take(1))[0];
    if (!draft || isAnonymousDraftExpired(draft.lastActivityAt, args.now) || draft.phase === "registered" || draft.phase === "cancelled") return null;
    return { phase: draft.phase, sessionId: draft.sessionId, messages: await ctx.db.query("anonymousReportMessages").withIndex("by_draft_id_and_sequence", (q) => q.eq("draftId", draft._id)).order("asc").take(100) };
  },
});
