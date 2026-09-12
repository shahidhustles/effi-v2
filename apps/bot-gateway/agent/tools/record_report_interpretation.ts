import { issueCategories } from "@effi/domain";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import {
  durableReportStore,
  reportConversationFromContext,
  reportStore,
} from "../lib/reporting.js";

type RecordedInterpretation = {
  issue: string;
  category: string;
  coordinates: { latitude: number; longitude: number };
  acceptedPhotos: number;
};

export const interpretationConfirmationText = (interpretation: RecordedInterpretation): string => [
  `Issue: ${interpretation.issue}`,
  `Category: ${interpretation.category}`,
  `Coordinates: ${interpretation.coordinates.latitude}, ${interpretation.coordinates.longitude}`,
  `Accepted photos: ${interpretation.acceptedPhotos}`,
  "Is this correct?",
].join("\n");

export default defineTool({
  description: "Record the report interpretation the citizen will confirm: the exact issue text and category. Call it right before presenting the interpretation for confirmation, both initially and after every correction, so the frozen record matches what the citizen sees.",
  inputSchema: z.object({
    issue: z.string().trim().min(1).max(500),
    category: z.enum(issueCategories),
  }),
  async execute({ issue, category }, ctx) {
    const { channel, conversationId } = reportConversationFromContext(ctx);
    const interpretation = reportStore.recordReviewInterpretation(channel, conversationId, { issue, category });
    const conversation = reportStore.activeConversation(channel, conversationId);
    if (conversation && durableReportStore) await durableReportStore.syncConversation(conversation);
    return {
      recorded: true,
      interpretation: {
        issue: interpretation.issue,
        category: interpretation.category,
        coordinates: interpretation.location,
        acceptedPhotos: interpretation.primaryEvidence.length,
      },
    };
  },
  toModelOutput(output) {
    return toolOutput.content([
      toolOutputPart.text(interpretationConfirmationText(output.interpretation)),
    ]);
  },
});
