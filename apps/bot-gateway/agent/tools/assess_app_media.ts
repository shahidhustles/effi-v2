import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";
import { appReportMediaStore } from "../lib/reporting.js";

export default defineTool({
  description:
    "Persist your verdict for citizen-app media after inspect_app_media has returned the image or video observation.",
  inputSchema: z.object({
    mediaId: z.string().min(1),
    assessmentKey: z.string().min(32),
    assessment: z.enum(["satisfactory", "insufficient"]),
  }),
  async execute({ mediaId, assessmentKey, assessment }) {
    if (!appReportMediaStore) {
      throw new Error("App media storage is not configured.");
    }
    return await appReportMediaStore.assess(mediaId, assessmentKey, assessment);
  },
  toModelOutput(output) {
    return toolOutput.text(
      `Citizen app media assessed as ${output.assessment}.`,
    );
  },
});
