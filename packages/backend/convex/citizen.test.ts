import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const citizenA = {
  tokenIdentifier: "clerk|citizen-a",
  subject: "citizen-a",
  name: "Citizen A",
};
const citizenB = {
  tokenIdentifier: "clerk|citizen-b",
  subject: "citizen-b",
  name: "Citizen B",
};

const test = () => convexTest(schema, import.meta.glob("./**/*.*s"));

const seedCitizenCase = async (
  t: ReturnType<typeof convexTest>,
  identity: typeof citizenA,
) =>
  t.run(async (ctx) => {
    const existing = await ctx.db
      .query("identities")
      .filter((q) => q.eq(q.field("externalId"), identity.tokenIdentifier))
      .first();
    const citizenId = existing?._id ?? (await ctx.db.insert("identities", {
      externalId: identity.tokenIdentifier,
      role: "citizen",
    }));
    const now = Date.now();
    const location = {
      source: "current_gps" as const,
      latitude: 3.139,
      longitude: 101.6869,
      place: {
        name: "Bukit Bintang",
        formattedAddress: "Bukit Bintang, Kuala Lumpur, Malaysia",
      },
    };
    const reportId = await ctx.db.insert("reports", {
      citizenId,
      reportNumber: "pending",
      channel: "app",
      conversationId: "app",
      issue: "The streetlight outside 12 Jalan Mawar has been dark for a week.",
      category: "lighting",
      location,
      primaryEvidence: [],
      reportedAt: now,
      submittedAt: now,
    });
    const reportNumber = `RPT-${reportId}`;
    await ctx.db.patch(reportId, { reportNumber });
    const caseId = await ctx.db.insert("cases", {
      reportId,
      reportNumber,
      summary:
        "The streetlight outside 12 Jalan Mawar has been dark for a week.",
      category: "lighting",
      location,
      reportedAt: now,
      submittedAt: now,
      recommendedPriority: "medium",
      currentPriority: "medium",
      priorityReasons: [],
      citations: [],
      acceptedEvidence: [],
      channel: "app",
      conversationId: "app",
      status: "new",
    });
    return { caseId, reportId, reportNumber, location };
  });

describe("citizen account", () => {
  it("rejects signed-out callers and reports no viewer", async () => {
    const t = test();
    await expect(t.mutation(api.citizen.ensureCitizen, {})).rejects.toThrow(
      /sign in/i,
    );
    await expect(t.query(api.citizen.viewer, {})).resolves.toBeNull();
  });

  it("creates one citizen record per Clerk account and keeps it stable", async () => {
    const t = test();
    const first = await t
      .withIdentity(citizenA)
      .mutation(api.citizen.ensureCitizen, {});
    expect(first.role).toBe("citizen");
    const second = await t
      .withIdentity(citizenA)
      .mutation(api.citizen.ensureCitizen, {});
    expect(second).toEqual(first);
    await t.run(async (ctx) => {
      const identities = await ctx.db.query("identities").take(10);
      expect(identities).toHaveLength(1);
      expect(identities[0]?.externalId).toBe(citizenA.tokenIdentifier);
    });
  });

  it("returns the caller's account state and nothing for another citizen", async () => {
    const t = test();
    const account = await t
      .withIdentity(citizenA)
      .mutation(api.citizen.ensureCitizen, {});
    await expect(
      t.withIdentity(citizenB).query(api.citizen.viewer, {}),
    ).resolves.toBeNull();
    await expect(
      t.withIdentity(citizenA).query(api.citizen.viewer, {}),
    ).resolves.toEqual(account);
  });
});

describe("citizen case tracking", () => {
  it("lists only the signed-in citizen's own cases", async () => {
    const t = test();
    const own = await seedCitizenCase(t, citizenA);
    await seedCitizenCase(t, citizenB);

    const list = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCases, {});
    expect(list).toHaveLength(1);
    expect(list[0]?.caseId).toBe(own.caseId);
    expect(list[0]?.location).toEqual(own.location);
    await expect(t.query(api.citizen.viewerCases, {})).resolves.toEqual([]);
  });

  it("paginates through the citizen's complete case history", async () => {
    const t = test();
    const older = await seedCitizenCase(t, citizenA);
    const newer = await seedCitizenCase(t, citizenA);
    await seedCitizenCase(t, citizenB);

    const first = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCaseHistory, {
        paginationOpts: { numItems: 1, cursor: null },
      });
    expect(first.page.map((entry) => entry.caseId)).toEqual([newer.caseId]);
    expect(first.isDone).toBe(false);

    const second = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCaseHistory, {
        paginationOpts: { numItems: 1, cursor: first.continueCursor },
      });
    expect(second.page.map((entry) => entry.caseId)).toEqual([older.caseId]);
    expect(second.isDone).toBe(true);
  });

  it("reads a case only through the owner's report", async () => {
    const t = test();
    const own = await seedCitizenCase(t, citizenA);

    const detail = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCase, { caseId: own.caseId });
    expect(detail?.case.reportNumber).toBe(own.reportNumber);
    await expect(
      t
        .withIdentity(citizenB)
        .query(api.citizen.viewerCase, { caseId: own.caseId }),
    ).resolves.toBeNull();
    await expect(
      t.query(api.citizen.viewerCase, { caseId: own.caseId }),
    ).resolves.toBeNull();
  });

  it("reflects an officer status change on the citizen's case", async () => {
    const t = test();
    const own = await seedCitizenCase(t, citizenA);
    await t.run(async (ctx) => {
      await ctx.db.patch(own.caseId, { status: "work_in_progress" });
    });

    const list = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCases, {});
    expect(list[0]?.status).toBe("work_in_progress");
    const detail = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCase, { caseId: own.caseId });
    expect(detail?.case.status).toBe("work_in_progress");
  });

  it("returns a citizen-safe action timeline and folds the assignment transition", async () => {
    const t = test();
    const own = await seedCitizenCase(t, citizenA);

    await t.run(async (ctx) => {
      const officerId = await ctx.db.insert("identities", {
        externalId: "clerk|officer",
        role: "officer",
      });
      const assignedAt = Date.now();
      await ctx.db.insert("caseAuditEvents", {
        caseId: own.caseId,
        actorIdentityId: officerId,
        actorName: "Asha Rao",
        occurredAt: assignedAt,
        event: { kind: "case_assigned", assignedOfficerId: officerId },
      });
      await ctx.db.insert("caseAuditEvents", {
        caseId: own.caseId,
        actorIdentityId: officerId,
        actorName: "Asha Rao",
        occurredAt: assignedAt,
        event: { kind: "status_changed", from: "new", to: "assigned" },
      });
      await ctx.db.insert("caseAuditEvents", {
        caseId: own.caseId,
        actorIdentityId: officerId,
        actorName: "Asha Rao",
        occurredAt: assignedAt + 1,
        event: { kind: "priority_changed", from: "medium", to: "high" },
      });
      await ctx.db.insert("caseAuditEvents", {
        caseId: own.caseId,
        actorIdentityId: officerId,
        actorName: "Asha Rao",
        occurredAt: assignedAt + 2,
        event: {
          kind: "case_resolved",
          from: "work_in_progress",
          to: "resolved",
          resolutionNote: "The damaged streetlight was replaced and tested.",
        },
      });
    });

    const detail = await t
      .withIdentity(citizenA)
      .query(api.citizen.viewerCase, { caseId: own.caseId });
    expect(detail?.timeline.map((entry) => entry.event.kind)).toEqual([
      "registered",
      "assigned",
      "priority_changed",
      "resolved",
    ]);
    expect(detail?.timeline[1]?.actorName).toBe("Asha Rao");
    expect(detail?.timeline[3]?.event).toMatchObject({
      kind: "resolved",
      resolutionNote: "The damaged streetlight was replaced and tested.",
    });
    expect(
      detail?.timeline.some((entry) => "assignedOfficerId" in entry.event),
    ).toBe(false);
    await expect(
      t
        .withIdentity(citizenB)
        .query(api.citizen.viewerCase, { caseId: own.caseId }),
    ).resolves.toBeNull();
  });
});
