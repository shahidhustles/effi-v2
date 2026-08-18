import { defineAgent } from "eve";

const primaryModel = process.env.EFFI_AI_MODEL ?? "meta/muse-spark-1.2-contributor";
const fallbackModel = process.env.EFFI_AI_FALLBACK_MODEL ?? "google/gemini-3.6-flash";

export default defineAgent({
  model: primaryModel,
  // AI Gateway retains the model that actually handled each step in Eve's trace.
  modelOptions: {
    providerOptions: {
      gateway: { models: [fallbackModel] },
    },
  },
});
