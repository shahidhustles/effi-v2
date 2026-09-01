import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import { durableReportStore, reportConversationFromContext, reportStore } from "../lib/reporting.js";

export default defineTool({
  description: "Record your assessment of a staged image that is already attached to the citizen's message. Call once with the verdict after judging the photo you can see directly.",
  inputSchema: z.object({
    attachmentId: z.string().min(1),
    assessment: z.enum(["satisfactory", "insufficient"]),
  }),
  async execute({ attachmentId, assessment }, ctx) {
    const { channel, conversationId } = reportConversationFromContext(ctx);
    const attachment = reportStore.attachment(channel, conversationId, attachmentId);
    if (!attachment) throw new Error("The staged image is not present in this channel conversation.");

    reportStore.markAttachmentInspected(channel, conversationId, attachmentId);
    reportStore.recordAttachmentQuality(channel, conversationId, attachmentId, assessment);
    const conversation = reportStore.activeConversation(channel, conversationId);
    if (conversation && durableReportStore) await durableReportStore.syncConversation(conversation);

    const updatedAttachment = reportStore.attachment(channel, conversationId, attachmentId);
    if (!updatedAttachment) throw new Error("The staged image is not present in this channel conversation.");
    // Keep the model-facing result small: the image itself is attached to the
    // user message as a lazy file part. Returning base64 here would persist it
    // in session history and re-send it on every subsequent model call.
    return {
      attachmentId: updatedAttachment.id,
      mediaType: updatedAttachment.mediaType,
      storageKey: updatedAttachment.storageKey,
      assessment,
    };
  },
  toModelOutput(output) {
    return toolOutput.text(`Staged image ${output.attachmentId} assessed as ${output.assessment}.`);
  },
});
