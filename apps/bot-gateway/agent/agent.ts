import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent, defineDynamic } from "eve";

const opencodeBaseUrl = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const opencodeModel = process.env.OPENCODE_GO_MODEL ?? "muse-spark-1.3-contributor";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const apiKey = process.env.OPENCODE_GO_API_KEY;
        if (!apiKey) throw new Error("OPENCODE_GO_API_KEY is required.");
        const opencode = createOpenAI({
          name: "opencode-go",
          baseURL: opencodeBaseUrl,
          apiKey,
          headers: {
            "user-agent": "effi-bot-gateway/0.0.0",
            "x-opencode-session": ctx.session.id,
          },
        });
        return {
          model: opencode.responses(opencodeModel),
          modelContextWindowTokens: 131_072,
        };
      },
    },
  }),
  defaultTools: false,
});
