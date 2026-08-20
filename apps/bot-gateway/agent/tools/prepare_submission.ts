import { issueCategories } from "@effi/domain";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import {
  durableReportStore,
  pendingSubmissionDelivery,
  reportConversationFromContext,
  reportStore,
} from "../lib/reporting.js";

export default defineTool({
  description: "Prepare an immutable pending civic-report submission after the citizen reviews the complete interpretation. Effi requires a fresh human approval before this side effect executes.",
  inputSchema: z.object({
    issue: z.string().trim().min(1),
    category: z.enum(issueCategories),
    acceptedAttachmentIds: z.array(z.string().min(1)).min(1),
  }),
  approval: always(),
  async execute({ issue, category, acceptedAttachmentIds }, ctx) {
    const { channel, conversationId } = reportConversationFromContext(ctx);
    const latestMessage = reportStore.latestMessage(channel, conversationId);
    const pending = reportStore.prepareSubmission({
      channel,
      conversationId,
      issue,
      category,
      acceptedAttachmentIds,
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
