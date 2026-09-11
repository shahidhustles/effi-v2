import { v } from "convex/values";

export const channelValidator = v.union(v.literal("telegram"), v.literal("whatsapp"));
export const issueCategoryValidator = v.union(
  v.literal("roads"),
  v.literal("sanitation"),
  v.literal("water"),
  v.literal("lighting"),
  v.literal("drainage"),
  v.literal("other"),
);
export const priorityValidator = v.union(
  v.literal("critical"),
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);
export const caseStatusValidator = v.union(
  v.literal("new"),
  v.literal("assigned"),
  v.literal("under_inspection"),
  v.literal("work_in_progress"),
  v.literal("resolved"),
);
export const locationSourceValidator = v.union(v.literal("current_gps"), v.literal("selected_pin"));
export const exactLocationValidator = v.object({
  source: locationSourceValidator,
  latitude: v.number(),
  longitude: v.number(),
});

export const acceptedEvidenceValidator = v.object({
  attachmentId: v.string(),
  storageKey: v.string(),
  mediaType: v.string(),
  sourceMessageId: v.string(),
});

export const sourceCitationValidator = v.union(
  v.object({
    kind: v.literal("transcript_message"),
    sourceMessageId: v.string(),
    explanation: v.string(),
  }),
  v.object({
    kind: v.literal("accepted_evidence"),
    attachmentId: v.string(),
    explanation: v.string(),
  }),
);

export const caseBriefValidator = v.object({
  summary: v.string(),
  category: issueCategoryValidator,
  priority: v.object({
    priority: priorityValidator,
    reasons: v.array(v.string()),
  }),
  citations: v.array(sourceCitationValidator),
});

export const transcriptInputRequestValidator = v.object({
  requestId: v.string(),
  prompt: v.string(),
  options: v.array(v.object({ id: v.string(), label: v.string() })),
  allowFreeform: v.boolean(),
});

const transcriptAttachmentPayloadValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("image"), v.literal("audio")),
  mediaType: v.string(),
  platformUrl: v.string(),
  quality: v.optional(v.union(
    v.literal("satisfactory"),
    v.literal("insufficient"),
    v.literal("unrelated"),
    v.literal("unusable"),
    v.literal("uncertain"),
    v.literal("undecodable"),
  )),
  decodable: v.optional(v.boolean()),
  inspected: v.optional(v.boolean()),
  platformReference: v.optional(v.string()),
  storageKey: v.optional(v.string()),
  decodeStatus: v.optional(v.union(v.literal("decoded"), v.literal("undecodable"))),
});

const voicePayloadValidator = v.object({
  attachmentId: v.string(),
  mediaType: v.string(),
  platformReference: v.string(),
  storageKey: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("transcribed"),
    v.literal("unintelligible"),
    v.literal("language_unknown"),
    v.literal("failed"),
  ),
  languageCode: v.optional(v.string()),
});

export const citizenTranscriptPayloadValidator = v.object({
  id: v.string(),
  providerEventId: v.optional(v.string()),
  channel: channelValidator,
  conversationId: v.string(),
  senderId: v.string(),
  text: v.optional(v.string()),
  voiceTranscript: v.optional(v.string()),
  voice: v.optional(voicePayloadValidator),
  action: v.optional(v.union(v.literal("confirm"), v.literal("edit"), v.literal("help"), v.literal("cancel"))),
  attachments: v.optional(v.array(transcriptAttachmentPayloadValidator)),
  location: v.optional(exactLocationValidator),
  receivedAt: v.string(),
});

export const effiTranscriptPayloadValidator = v.object({
  role: v.literal("assistant"),
  text: v.string(),
  source: v.union(v.literal("assistant_message"), v.literal("input_request")),
  inputRequest: v.optional(transcriptInputRequestValidator),
});

export const anonymousTranscriptPayloadValidator = v.union(
  citizenTranscriptPayloadValidator,
  effiTranscriptPayloadValidator,
);

export const normalizedTranscriptAttachmentValidator = v.object({
  attachmentId: v.string(),
  storageKey: v.string(),
  mediaType: v.string(),
  accepted: v.boolean(),
});

export const caseTranscriptContentValidator = v.union(
  v.object({
    kind: v.literal("citizen_message"),
    text: v.optional(v.string()),
    voiceTranscript: v.optional(v.string()),
    action: v.optional(v.union(v.literal("confirm"), v.literal("edit"), v.literal("help"), v.literal("cancel"))),
    location: v.optional(exactLocationValidator),
    attachments: v.array(normalizedTranscriptAttachmentValidator),
  }),
  v.object({
    kind: v.literal("effi_message"),
    text: v.string(),
  }),
  v.object({
    kind: v.literal("input_request"),
    text: v.string(),
    requestId: v.string(),
    prompt: v.string(),
    options: v.array(v.object({ id: v.string(), label: v.string() })),
    allowFreeform: v.boolean(),
  }),
);
