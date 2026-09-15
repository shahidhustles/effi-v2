import { Buffer } from "node:buffer";
import { defineTool, toolOutput, toolOutputPart } from "eve/tools";
import { z } from "zod";
import { createVideoObservationProvider } from "../../src/video-observation.js";
import { appReportMediaStore } from "../lib/reporting.js";

const observeVideo = createVideoObservationProvider();

export default defineTool({
  description:
    "Inspect one image or video uploaded by the citizen app. Use the mediaId and assessmentKey from effi_app_media context. This returns the visual evidence needed before assess_app_media is called.",
  inputSchema: z.object({
    mediaId: z.string().min(1),
    assessmentKey: z.string().min(32),
  }),
  async execute({ mediaId, assessmentKey }) {
    if (!appReportMediaStore) {
      throw new Error("App media storage is not configured.");
    }
    const media = await appReportMediaStore.get(mediaId, assessmentKey);
    if (!media) throw new Error("The app media is no longer available.");
    const response = await fetch(media.url);
    if (!response.ok) throw new Error("The app media could not be downloaded.");
    const data = new Uint8Array(await response.arrayBuffer());

    if (media.kind === "video") {
      const observation = await observeVideo({
        data,
        mediaType: media.mediaType,
      });
      if (!observation) {
        return {
          kind: media.kind,
          mediaType: media.mediaType,
          observation: null,
        };
      }
      return { kind: media.kind, mediaType: media.mediaType, observation };
    }
    return {
      kind: media.kind,
      mediaType: media.mediaType,
      imageBase64: Buffer.from(data).toString("base64"),
      observation: null,
    };
  },
  toModelOutput(output) {
    if (output.kind === "image" && output.imageBase64) {
      return toolOutput.content([
        toolOutputPart.text("Citizen app image for visual assessment:"),
        toolOutputPart.file(output.imageBase64, {
          mediaType: output.mediaType,
        }),
      ]);
    }
    return toolOutput.text(
      output.observation
        ? `Citizen app video observation: ${output.observation}`
        : "The citizen app video could not be inspected. Ask for a clearer replacement.",
    );
  },
});
