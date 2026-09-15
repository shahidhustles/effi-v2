import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOrCreateAccount } from "./citizen";
import {
  assertCoordinate,
  distanceBetweenMetres,
  isActiveAssignedStatus,
  searchRadiusMetres,
} from "./nearbyIssues";

const repostResultValidator = v.object({
  repostCount: v.number(),
  viewerHasReposted: v.boolean(),
});

const findRepost = async (
  ctx: MutationCtx,
  caseId: Id<"cases">,
  citizenId: Id<"identities">,
) =>
  await ctx.db
    .query("caseReposts")
    .withIndex("by_case_id_and_citizen_id", (q) =>
      q.eq("caseId", caseId).eq("citizenId", citizenId),
    )
    .unique();

/** One repost per citizen per issue, accepted only within 3 km of the issue. */
export const repostCase = mutation({
  args: {
    caseId: v.id("cases"),
    latitude: v.number(),
    longitude: v.number(),
  },
  returns: repostResultValidator,
  handler: async (ctx, args) => {
    const citizen = await getOrCreateAccount(ctx);
    const viewerLocation = {
      latitude: args.latitude,
      longitude: args.longitude,
    };
    assertCoordinate(viewerLocation);
    const record = await ctx.db.get(args.caseId);
    if (!record) throw new Error("Unknown case.");
    if (!record.assignedOfficerId || !isActiveAssignedStatus(record.status)) {
      throw new Error("This issue is no longer active.");
    }
    if (
      distanceBetweenMetres(viewerLocation, record.location) >
      searchRadiusMetres
    ) {
      throw new Error("Move within 3 km of this issue to repost it.");
    }
    const repostCount = record.repostCount ?? 0;
    const existing = await findRepost(ctx, record._id, citizen._id);
    if (existing) return { repostCount, viewerHasReposted: true };
    await ctx.db.insert("caseReposts", {
      caseId: record._id,
      citizenId: citizen._id,
      latitude: viewerLocation.latitude,
      longitude: viewerLocation.longitude,
    });
    const nextCount = repostCount + 1;
    await ctx.db.patch(record._id, { repostCount: nextCount });
    return { repostCount: nextCount, viewerHasReposted: true };
  },
});

/** Removes the signed-in citizen's repost; safe to call when none exists. */
export const removeRepost = mutation({
  args: { caseId: v.id("cases") },
  returns: repostResultValidator,
  handler: async (ctx, args) => {
    const citizen = await getOrCreateAccount(ctx);
    const record = await ctx.db.get(args.caseId);
    if (!record) throw new Error("Unknown case.");
    const repostCount = record.repostCount ?? 0;
    const existing = await findRepost(ctx, record._id, citizen._id);
    if (!existing) return { repostCount, viewerHasReposted: false };
    await ctx.db.delete(existing._id);
    const nextCount = Math.max(0, repostCount - 1);
    await ctx.db.patch(record._id, { repostCount: nextCount });
    return { repostCount: nextCount, viewerHasReposted: false };
  },
});
