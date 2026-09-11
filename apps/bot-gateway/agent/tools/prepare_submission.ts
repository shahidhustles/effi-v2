import { caseBriefV1Schema } from "@effi/ai-contracts";
import { issueCategories } from "@effi/domain";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import {
  durableReportStore,
  pendingSubmissionDelivery,
  reportConversationFromContext,
  reportStore,
} from "../lib/reporting.js";

export default defineTool({
  description: "Prepare an immutable pending civic-report submission after explicit citizen confirmation. Include a short evidence-backed case brief, priority reasons, and citations to persisted message IDs or accepted attachment IDs.",
  inputSchema: caseBriefV1Schema.extend({
    issue: z.string().trim().min(1),
    category: z.enum(issueCategories),
    acceptedAttachmentIds: z.array(z.string().min(1)).min(1),
  }),
  async execute({ issue, category, acceptedAttachmentIds, summary, priority, citations }, ctx) {
    const { channel, conversationId } = reportConversationFromContext(ctx);
    const latestMessage = reportStore.latestMessage(channel, conversationId);
    const pending = reportStore.prepareSubmission({
      channel,
      conversationId,
      issue,
      category,
      acceptedAttachmentIds,
      caseBrief: { summary, category, priority, citations },
      receivedAt: latestMessage?.receivedAt ?? new Date().toISOString(),
    });
    const conversation = reportStore.activeConversation(channel, conversationId);
    if (conversation && durableReportStore) {
      await durableReportStore.syncConversation(conversation);
      const frozen = reportStore.pendingSubmission(pending.authenticationLink);
      if (!frozen) throw new Error("Pending submission was not retained.");
      await durableReportStore.persistPendingSubmission(frozen);
    }

    return pendingSubmissionDelivery(pending.authenticationLink);
  },
  toModelOutput(output) {
    // The model sees the exact citizen-facing delivery text and must send it
    // verbatim. Presenting the plain message prevents the model from re-calling
    // this tool to "obtain" the link.
    return toolOutput.content([
      toolOutputPart.text(`The pending submission is ready. Send this exact message to the citizen: ${output.recipientMessage}`),
    ]);
  },
});
