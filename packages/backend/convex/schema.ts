import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  identities: defineTable({
    externalId: v.string(),
    role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin"))
  }).index("by_external_id", ["externalId"])
});
