import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent, defineDynamic } from "eve";

const opencodeBaseUrl = process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const opencodeModel = process.env.OPENCODE_MODEL ?? "muse-spark-1.3-contributor";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const apiKey = process.env.OPENCODE_API_KEY;
        if (!apiKey) throw new Error("OPENCODE_API_KEY is required.");
        const opencode = createOpenAI({
          name: "opencode",
          baseURL: opencodeBaseUrl,
          apiKey,
          headers: {
            "user-agent": "opencode/1.0 ai-sdk",
            "x-opencode-client": "cli",
            "x-opencode-project": "global",
            "x-opencode-session": `ses_effi_${ctx.session.id}`,
            "x-opencode-request": `req_effi_${ctx.session.id}`,
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
