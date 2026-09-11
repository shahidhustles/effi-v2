import { issueCategories, priorities } from "@effi/domain";
import { z } from "zod";

export const priorityRecommendationSchema = z.object({
  priority: z.enum(priorities),
  reasons: z.array(z.string().trim().min(1)).min(1).max(5),
});
export const sourceCitationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("transcript_message"),
    sourceMessageId: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("accepted_evidence"),
    attachmentId: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
  }),
]);
export const clarificationRequestSchema = z.object({ question: z.string().min(1), missing: z.enum(["issue", "location", "usable_evidence"]) });
export const caseBriefV1Schema = z.object({
  summary: z.string().trim().min(1).max(280),
  category: z.enum(issueCategories),
  priority: priorityRecommendationSchema,
  citations: z.array(sourceCitationSchema).min(1).max(10),
});

export type CaseBriefV1 = z.infer<typeof caseBriefV1Schema>;
