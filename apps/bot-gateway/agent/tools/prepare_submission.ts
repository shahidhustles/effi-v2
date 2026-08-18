import { issueCategories } from "@effi/domain";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { telegramConversationIdFromContext, telegramReportIngress } from "../lib/telegram-reporting.js";

export default defineTool({
  description: "Prepare an immutable pending civic-report submission after the citizen reviews the complete interpretation. Effi requires a fresh human approval before this side effect executes.",
  inputSchema: z.object({
    issue: z.string().trim().min(1),
    category: z.enum(issueCategories),
    acceptedAttachmentIds: z.array(z.string().min(1)).min(1),
  }),
  approval: always(),
  async execute({ issue, category, acceptedAttachmentIds }, ctx) {
    const conversationId = telegramConversationIdFromContext(ctx);
    const latestMessage = telegramReportIngress.store.latestMessage("telegram", conversationId);
    const pending = telegramReportIngress.store.prepareSubmission({
      channel: "telegram",
      conversationId,
      issue,
      category,
      acceptedAttachmentIds,
      receivedAt: latestMessage?.receivedAt ?? new Date().toISOString(),
    });

    return {
      authenticationLink: pending.authenticationLink,
      pendingSubmissionId: pending.pendingSubmissionId,
      status: "authentication_required" as const,
    };
  },
});
