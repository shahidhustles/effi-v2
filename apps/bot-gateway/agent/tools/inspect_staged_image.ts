import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import { telegramConversationIdFromContext, telegramReportIngress } from "../lib/telegram-reporting.js";

export default defineTool({
  description: "Inspect one image that Effi already copied into controlled storage. Call once to view it, then call again with an assessment after deciding whether it is usable civic evidence.",
  inputSchema: z.object({
    attachmentId: z.string().min(1),
    assessment: z.enum(["satisfactory", "insufficient"]).optional(),
  }),
  async execute({ attachmentId, assessment }, ctx) {
    const conversationId = telegramConversationIdFromContext(ctx);
    const attachment = telegramReportIngress.store.attachment("telegram", conversationId, attachmentId);
    if (!attachment) throw new Error("The staged image is not present in this Telegram conversation.");

    if (assessment) {
      telegramReportIngress.store.recordAttachmentQuality("telegram", conversationId, attachmentId, assessment);
    } else {
      telegramReportIngress.store.markAttachmentInspected("telegram", conversationId, attachmentId);
    }

    const updatedAttachment = telegramReportIngress.store.attachment("telegram", conversationId, attachmentId);
    if (!updatedAttachment) throw new Error("The staged image is not present in this Telegram conversation.");
    const bytes = await telegramReportIngress.adapter.storage.read(updatedAttachment.storageKey);
    return {
      attachmentId: updatedAttachment.id,
      mediaType: updatedAttachment.mediaType,
      storageKey: updatedAttachment.storageKey,
      base64: Buffer.from(bytes).toString("base64"),
    };
  },
  toModelOutput(output) {
    return toolOutput.content([
      toolOutputPart.text(`Inspect staged image ${output.attachmentId} from Effi-controlled storage.`),
      toolOutputPart.file(output.base64, { mediaType: output.mediaType }),
    ]);
  },
});
