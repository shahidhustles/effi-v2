export type NearbyIssueCategory =
  "roads" | "sanitation" | "water" | "lighting" | "drainage" | "other";
export type NearbyIssueStatus =
  "assigned" | "under_inspection" | "work_in_progress";

export type HeatPoint = {
  latitude: number;
  longitude: number;
  weight: number;
};

export type NearbyIssue = {
  caseId: string;
  category: NearbyIssueCategory;
  summary: string;
  locality: string;
  status: NearbyIssueStatus;
  distanceMetres: number;
  repostCount: number;
  viewerHasReposted: boolean;
};

export type NearbyIssuesResult = {
  radiusMetres: 3000;
  issues: NearbyIssue[];
  heatPoints: HeatPoint[];
};

export const categoryLabel = (category: NearbyIssueCategory): string => {
  switch (category) {
    case "roads":
      return "Roads";
    case "sanitation":
      return "Sanitation";
    case "water":
      return "Water";
    case "lighting":
      return "Lighting";
    case "drainage":
      return "Drainage";
    case "other":
      return "Other";
    default: {
      const unhandled: never = category;
      return unhandled;
    }
  }
};

export const statusLabel = (status: NearbyIssueStatus): string => {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "under_inspection":
      return "Under inspection";
    case "work_in_progress":
      return "Work in progress";
    default: {
      const unhandled: never = status;
      return unhandled;
    }
  }
};

export const formatDistance = (distanceMetres: number): string => {
  if (distanceMetres < 1_000)
    return `${Math.max(10, Math.round(distanceMetres / 10) * 10)} m`;
  return `${(distanceMetres / 1_000).toFixed(1)} km`;
};

export const nearbyIssueCountLabel = (count: number): string =>
  `${count} active ${count === 1 ? "issue" : "issues"} within 3 km`;

export const repostCountLabel = (count: number): string => {
  if (count === 0) return "No reposts yet";
  return count === 1 ? "1 repost" : `${count} reposts`;
};

export const repostAccessibilityLabel = (
  count: number,
  hasReposted: boolean,
): string => {
  const action = hasReposted ? "Remove your repost" : "Repost this issue";
  return count === 0
    ? `${action}. No reposts yet.`
    : `${action}. ${repostCountLabel(count)} so far.`;
};
