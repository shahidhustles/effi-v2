import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Prepare the immutable pending submission after a citizen explicitly confirms the complete report interpretation.",
  inputSchema: z.object({
    pendingSubmissionId: z.string().min(1),
    confirmation: z.literal("confirmed"),
  }),
  async execute({ pendingSubmissionId }) {
    return { pendingSubmissionId, status: "authentication_required" as const };
  },
});
