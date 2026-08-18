import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.EFFI_AI_MODEL ?? "meta/muse-spark-1.2-contributor",
});
