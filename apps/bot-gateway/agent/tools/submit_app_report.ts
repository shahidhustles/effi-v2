import { issueCategories } from "@effi/domain";
import { defineTool, toolOutput } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description:
    "Present the final citizen-app report for explicit approval. Use only in the citizen app after the issue, accepted app media, and one exact GPS location are complete. The authenticated app creates the Convex case before it approves this tool.",
  inputSchema: z.object({
    issue: z.string().trim().min(1).max(500),
    category: z.enum(issueCategories),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    mediaIds: z.array(z.string().min(1)).min(1).max(5),
    summary: z.string().trim().min(1).max(280),
    recommendedPriority: z.enum(["critical", "high", "medium", "low"]),
    priorityReasons: z.array(z.string().trim().min(1)).min(1).max(5),
  }),
  approval: always(),
  execute(input) {
    return { submitted: true, category: input.category };
  },
  toModelOutput(output) {
    return toolOutput.text(
      output.submitted
        ? "The authenticated citizen app submitted the approved report to Convex. Confirm registration briefly in the citizen's language."
        : "The report was not submitted.",
    );
  },
});
