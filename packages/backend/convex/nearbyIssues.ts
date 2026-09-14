import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { issueCategoryValidator } from "./case_contract";

const searchRadiusMetres = 3_000;
const maxResults = 50;
const maxCasesPerStatus = 100;
const approximateCoordinateDecimals = 3;

const activeAssignedStatusValidator = v.union(
  v.literal("assigned"),
  v.literal("under_inspection"),
  v.literal("work_in_progress"),
);

const nearbyIssueValidator = v.object({
  caseId: v.id("cases"),
  category: issueCategoryValidator,
  summary: v.string(),
  locality: v.string(),
  status: activeAssignedStatusValidator,
  distanceMetres: v.number(),
});

const heatPointValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
  weight: v.number(),
});

type Coordinate = { latitude: number; longitude: number };
type ActiveAssignedStatus =
  "assigned" | "under_inspection" | "work_in_progress";
type NearbyCandidate = {
  issue: {
    caseId: Doc<"cases">["_id"];
    category: Doc<"cases">["category"];
    summary: string;
    locality: string;
    status: ActiveAssignedStatus;
    distanceMetres: number;
  };
  heatPoint: Coordinate;
};
type NearbyResponse = {
  radiusMetres: 3000;
  issues: NearbyCandidate["issue"][];
  heatPoints: Array<Coordinate & { weight: number }>;
};

const activeAssignedStatuses: readonly ActiveAssignedStatus[] = [
  "assigned",
  "under_inspection",
  "work_in_progress",
];

export const assertCoordinate = ({ latitude, longitude }: Coordinate): void => {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("The current latitude is invalid.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("The current longitude is invalid.");
  }
};

export const distanceBetweenMetres = (
  from: Coordinate,
  to: Coordinate,
): number => {
  const earthRadiusMetres = 6_371_000;
  const degreesToRadians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * degreesToRadians;
  const longitudeDelta = (to.longitude - from.longitude) * degreesToRadians;
  const fromLatitude = from.latitude * degreesToRadians;
  const toLatitude = to.latitude * degreesToRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    earthRadiusMetres *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const isActiveAssignedStatus = (
  status: Doc<"cases">["status"],
): status is ActiveAssignedStatus => {
  switch (status) {
    case "assigned":
    case "under_inspection":
    case "work_in_progress":
      return true;
    case "new":
    case "resolved":
      return false;
    default: {
      const unhandled: never = status;
      return unhandled;
    }
  }
};

const sanitizeSummary = (summary: string): string => {
  const withoutEmail = summary.replace(
    /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,
    "[contact removed]",
  );
  const withoutPhone = withoutEmail.replace(
    /(?:\+?\d[\s().-]*){8,}/g,
    "[contact removed]",
  );
  const trimmed = withoutPhone.trim();
  return trimmed.length <= 140
    ? trimmed
    : `${trimmed.slice(0, 139).trimEnd()}…`;
};

const approximateLocality = (placeName: string | undefined): string => {
  const locality = placeName?.split(",")[0]?.trim();
  if (!locality || /\d/.test(locality)) return "Nearby area";
  return locality.length <= 60
    ? locality
    : `${locality.slice(0, 59).trimEnd()}…`;
};

const approximateCoordinate = (value: number): number =>
  Number(value.toFixed(approximateCoordinateDecimals));

const toCandidate = (
  record: Doc<"cases">,
  viewerLocation: Coordinate,
): NearbyCandidate | null => {
  if (!record.assignedOfficerId || !isActiveAssignedStatus(record.status))
    return null;
  const distanceMetres = distanceBetweenMetres(viewerLocation, record.location);
  if (distanceMetres > searchRadiusMetres) return null;
  return {
    issue: {
      caseId: record._id,
      category: record.category,
      summary: sanitizeSummary(record.summary),
      locality: approximateLocality(record.location.place?.name),
      status: record.status,
      distanceMetres: Math.round(distanceMetres),
    },
    heatPoint: {
      latitude: approximateCoordinate(record.location.latitude),
      longitude: approximateCoordinate(record.location.longitude),
    },
  };
};

const aggregateHeatPoints = (candidates: readonly NearbyCandidate[]) => {
  const points = new Map<string, Coordinate & { weight: number }>();
  for (const candidate of candidates) {
    const { latitude, longitude } = candidate.heatPoint;
    const key = `${latitude.toFixed(approximateCoordinateDecimals)},${longitude.toFixed(approximateCoordinateDecimals)}`;
    const existing = points.get(key);
    points.set(key, {
      latitude,
      longitude,
      weight: (existing?.weight ?? 0) + 1,
    });
  }
  return [...points.values()];
};

export const nearbyAssignedCases = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  returns: v.object({
    radiusMetres: v.literal(searchRadiusMetres),
    issues: v.array(nearbyIssueValidator),
    heatPoints: v.array(heatPointValidator),
  }),
  handler: async (ctx, args): Promise<NearbyResponse> => {
    const viewerLocation = {
      latitude: args.latitude,
      longitude: args.longitude,
    };
    assertCoordinate(viewerLocation);
    const authIdentity = await ctx.auth.getUserIdentity();
    if (!authIdentity) throw new Error("Sign in to view nearby issues.");
    const account = await ctx.db
      .query("identities")
      .withIndex("by_external_id", (q) =>
        q.eq("externalId", authIdentity.tokenIdentifier),
      )
      .unique();
    if (account && account.role !== "citizen")
      throw new Error("A citizen account is required.");

    const statusBatches = await Promise.all(
      activeAssignedStatuses.map(
        async (status) =>
          await ctx.db
            .query("cases")
            .withIndex("by_status_and_submitted_at", (q) =>
              q.eq("status", status),
            )
            .order("desc")
            .take(maxCasesPerStatus),
      ),
    );
    const candidates = statusBatches
      .flat()
      .map((record) => toCandidate(record, viewerLocation))
      .filter((candidate): candidate is NearbyCandidate => candidate !== null)
      .sort(
        (left, right) => left.issue.distanceMetres - right.issue.distanceMetres,
      )
      .slice(0, maxResults);

    return {
      radiusMetres: searchRadiusMetres,
      issues: candidates.map((candidate) => candidate.issue),
      heatPoints: aggregateHeatPoints(candidates),
    };
  },
});
