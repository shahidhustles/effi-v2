import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent, defineDynamic } from "eve";

const requiredEnvironmentValue = (name: "EFFI_MODEL_API_KEY" | "EFFI_MODEL_BASE_URL" | "EFFI_MODEL_ID"): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": (_event, ctx) => {
        const effiModel = createOpenAI({
          name: "effi-model",
          baseURL: requiredEnvironmentValue("EFFI_MODEL_BASE_URL"),
          apiKey: requiredEnvironmentValue("EFFI_MODEL_API_KEY"),
          headers: {
            "user-agent": "effi-bot-gateway/0.0.0",
            "x-effi-session": ctx.session.id,
          },
        });
        return {
          model: effiModel.chat(requiredEnvironmentValue("EFFI_MODEL_ID")),
          modelContextWindowTokens: 8_192,
        };
      },
    },
  }),
  defaultTools: false,
});
