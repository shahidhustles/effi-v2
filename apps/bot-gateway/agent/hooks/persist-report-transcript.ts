import { defineHook } from "eve/hooks";
import { durableReportStore, reportConversationFromAuth, reportStore } from "../lib/reporting.js";
import {
  completedMessageTranscriptEntry,
  inputRequestTranscriptEntries,
  isReportConfirmationRequest,
  type EffiTranscriptEntry,
} from "../lib/transcript.js";

const persistEntry = async (
  auth: Parameters<typeof reportConversationFromAuth>[0],
  entry: EffiTranscriptEntry,
): Promise<void> => {
  if (!durableReportStore) return;
  const reportConversation = reportConversationFromAuth(auth);
  if (!reportConversation) return;
  const conversation = reportStore.activeConversation(reportConversation.channel, reportConversation.conversationId);
  if (!conversation) throw new Error("The active report conversation is missing while persisting an Effi transcript entry.");
  const persisted = await durableReportStore.persistEffiTranscriptMessage({ conversation, ...entry });
  if (!persisted) throw new Error("The durable report draft is missing while persisting an Effi transcript entry.");
};

export default defineHook({
  events: {
    async "message.completed"(event, ctx) {
      const entry = completedMessageTranscriptEntry(event);
      if (entry) await persistEntry(ctx.session.auth, entry);
    },
    async "input.requested"(event, ctx) {
      const reportConversation = reportConversationFromAuth(ctx.session.auth);
      const confirmationRequested = event.data.requests?.some(isReportConfirmationRequest) ?? false;
      const reviewed = reportConversation && confirmationRequested
        ? reportStore.recordConfirmationReview(reportConversation.channel, reportConversation.conversationId)
        : undefined;
      for (const entry of inputRequestTranscriptEntries(event)) {
        await persistEntry(ctx.session.auth, entry);
      }
      const conversation = reportConversation
        ? reportStore.activeConversation(reportConversation.channel, reportConversation.conversationId)
        : undefined;
      if (reviewed && conversation && durableReportStore) await durableReportStore.syncConversation(conversation);
    },
  },
});
