import { z } from "zod";

export const priorityRecommendationSchema = z.object({ priority: z.enum(["critical", "high", "medium", "low"]), reasons: z.array(z.string()).min(1) });
export const sourceCitationSchema = z.object({ evidenceId: z.string(), explanation: z.string() });
export const clarificationRequestSchema = z.object({ question: z.string().min(1), missing: z.enum(["issue", "location", "usable_evidence"]) });
export const caseBriefV1Schema = z.object({ summary: z.string(), category: z.string(), priority: priorityRecommendationSchema, citations: z.array(sourceCitationSchema) });

export type CaseBriefV1 = z.infer<typeof caseBriefV1Schema>;
