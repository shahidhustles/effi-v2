import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const viewer = {
  tokenIdentifier: "clerk|nearby-viewer",
  subject: "nearby-viewer",
};
const test = () => convexTest(schema, import.meta.glob("./**/*.*s"));

type SeedCaseArgs = {
  citizenId: Id<"identities">;
  officerId: Id<"identities">;
  summary: string;
  status:
    "new" | "assigned" | "under_inspection" | "work_in_progress" | "resolved";
  latitude: number;
  longitude: number;
  assigned?: boolean;
  placeName?: string;
};

const seedCase = async (t: ReturnType<typeof convexTest>, args: SeedCaseArgs) =>
  t.run(async (ctx) => {
    const reportId = await ctx.db.insert("reports", {
      citizenId: args.citizenId,
      reportNumber: `RPT-${args.summary}`,
      channel: "app",
      conversationId: "app",
      issue: args.summary,
      category: "roads",
      location: {
        source: "current_gps",
        latitude: args.latitude,
        longitude: args.longitude,
        place: {
          name: args.placeName ?? "Indiranagar, Bengaluru",
          formattedAddress: "12 Exact Reporter Address, Bengaluru",
        },
      },
      primaryEvidence: [],
      reportedAt: 1,
      submittedAt: 1,
    });
    return await ctx.db.insert("cases", {
      reportId,
      reportNumber: `RPT-${args.summary}`,
      summary: args.summary,
      category: "roads",
      location: {
        source: "current_gps",
        latitude: args.latitude,
        longitude: args.longitude,
        place: {
          name: args.placeName ?? "Indiranagar, Bengaluru",
          formattedAddress: "12 Exact Reporter Address, Bengaluru",
        },
      },
      reportedAt: 1,
      submittedAt: 1,
      recommendedPriority: "critical",
      currentPriority: "critical",
      priorityReasons: ["Internal priority reason"],
      citations: [],
      acceptedEvidence: [],
      channel: "app",
      conversationId: "private-conversation",
      status: args.status,
      ...(args.assigned === false
        ? {}
        : {
            assignedOfficerId: args.officerId,
            assignedOfficerName: "Private Officer",
          }),
    });
  });

describe("nearby assigned cases", () => {
  it("requires a signed-in citizen", async () => {
    const t = test();
    await expect(
      t.query(api.nearbyIssues.nearbyAssignedCases, {
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    ).rejects.toThrow(/sign in/i);
  });

  it("lets a newly signed-in citizen see the empty nearby state", async () => {
    const t = test();
    await expect(
      t.withIdentity(viewer).query(api.nearbyIssues.nearbyAssignedCases, {
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    ).resolves.toEqual({ radiusMetres: 3_000, issues: [], heatPoints: [] });
  });

  it("returns only active assigned cases within three kilometres", async () => {
    const t = test();
    const ids = await t.run(async (ctx) => ({
      citizenId: await ctx.db.insert("identities", {
        externalId: viewer.tokenIdentifier,
        role: "citizen",
      }),
      officerId: await ctx.db.insert("identities", {
        externalId: "clerk|nearby-officer",
        role: "officer",
      }),
    }));
    const nearest = await seedCase(t, {
      ...ids,
      summary: "Pothole near the crossing, call me at +91 98765 43210",
      status: "assigned",
      latitude: 12.972,
      longitude: 77.595,
    });
    await seedCase(t, {
      ...ids,
      summary: "Damaged road divider",
      status: "under_inspection",
      latitude: 12.9724,
      longitude: 77.5954,
    });
    await seedCase(t, {
      ...ids,
      summary: "Unassigned pothole",
      status: "assigned",
      latitude: 12.972,
      longitude: 77.595,
      assigned: false,
    });
    await seedCase(t, {
      ...ids,
      summary: "New report",
      status: "new",
      latitude: 12.972,
      longitude: 77.595,
    });
    await seedCase(t, {
      ...ids,
      summary: "Resolved report",
      status: "resolved",
      latitude: 12.972,
      longitude: 77.595,
    });
    await seedCase(t, {
      ...ids,
      summary: "Far assigned report",
      status: "work_in_progress",
      latitude: 13.0716,
      longitude: 77.5946,
    });

    const result = await t
      .withIdentity(viewer)
      .query(api.nearbyIssues.nearbyAssignedCases, {
        latitude: 12.9716,
        longitude: 77.5946,
      });

    expect(result.radiusMetres).toBe(3_000);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]?.caseId).toBe(nearest);
    expect(result.issues[0]?.summary).toContain("[contact removed]");
    expect(
      result.issues.every(
        (issue) =>
          issue.status === "assigned" || issue.status === "under_inspection",
      ),
    ).toBe(true);
    expect(result.heatPoints).toEqual([
      { latitude: 12.972, longitude: 77.595, weight: 2 },
    ]);
  });

  it("returns a privacy-limited issue shape and hides address-like place names", async () => {
    const t = test();
    const ids = await t.run(async (ctx) => ({
      citizenId: await ctx.db.insert("identities", {
        externalId: viewer.tokenIdentifier,
        role: "citizen",
      }),
      officerId: await ctx.db.insert("identities", {
        externalId: "clerk|privacy-officer",
        role: "officer",
      }),
    }));
    await seedCase(t, {
      ...ids,
      summary: "Road surface has collapsed",
      status: "work_in_progress",
      latitude: 12.972,
      longitude: 77.595,
      placeName: "12 Reporter Lane",
    });

    const result = await t
      .withIdentity(viewer)
      .query(api.nearbyIssues.nearbyAssignedCases, {
        latitude: 12.9716,
        longitude: 77.5946,
      });
    const issue = result.issues[0];
    expect(issue?.locality).toBe("Nearby area");
    expect(Object.keys(issue ?? {}).sort()).toEqual([
      "caseId",
      "category",
      "distanceMetres",
      "locality",
      "status",
      "summary",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /Private Officer|Exact Reporter Address|critical|private-conversation/,
    );
  });
});
