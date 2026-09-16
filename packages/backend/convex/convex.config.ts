import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    EFFI_GATEWAY_CONVEX_SECRET: v.string(),
    EFFI_GATEWAY_MEDIA_ERASURE_URL: v.string(),
    SLA_INGESTION_SECRET: v.optional(v.string()),
  },
});
