export const heatmapRadiusMetres = 5_000;

export const casePriorities = ["critical", "high", "medium", "low"] as const;
export type HeatmapPriority = (typeof casePriorities)[number];

export const heatmapCaseStatuses = ["new", "assigned", "under_inspection", "work_in_progress"] as const;
export type HeatmapCaseStatus = (typeof heatmapCaseStatuses)[number];

export type Coordinates = { latitude: number; longitude: number };

export type HeatmapCase = {
  caseId: string;
  summary: string;
  status: HeatmapCaseStatus;
  currentPriority: HeatmapPriority;
  location: Coordinates;
  submittedAt: number;
};

export type NearbyHeatmapCase = HeatmapCase & { distanceMetres: number };

export type PopupAnchor = "top" | "top-left" | "top-right" | "bottom" | "bottom-left" | "bottom-right";

export function popupAnchorForPoint(
  point: { x: number; y: number },
  viewport: { width: number; height: number },
): PopupAnchor {
  const vertical = point.y < viewport.height / 2 ? "top" : "bottom";
  if (point.x < viewport.width / 3) return `${vertical}-left`;
  if (point.x > viewport.width * 2 / 3) return `${vertical}-right`;
  return vertical;
}

const earthRadiusMetres = 6_371_000;
const degreesToRadians = (degrees: number) => degrees * Math.PI / 180;

export const isValidCoordinates = ({ latitude, longitude }: Coordinates): boolean =>
  Number.isFinite(latitude)
  && latitude >= -90
  && latitude <= 90
  && Number.isFinite(longitude)
  && longitude >= -180
  && longitude <= 180;

export function distanceBetweenMetres(left: Coordinates, right: Coordinates): number {
  if (!isValidCoordinates(left) || !isValidCoordinates(right)) return Number.POSITIVE_INFINITY;

  const latitudeDelta = degreesToRadians(right.latitude - left.latitude);
  const longitudeDelta = degreesToRadians(right.longitude - left.longitude);
  const leftLatitude = degreesToRadians(left.latitude);
  const rightLatitude = degreesToRadians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMetres * Math.asin(Math.sqrt(haversine));
}

export function nearbyHeatmapCases(
  cases: readonly HeatmapCase[],
  officerLocation: Coordinates,
  radiusMetres = heatmapRadiusMetres,
): NearbyHeatmapCase[] {
  if (!isValidCoordinates(officerLocation) || !Number.isFinite(radiusMetres) || radiusMetres < 0) return [];

  return cases.flatMap((entry) => {
    const distanceMetres = distanceBetweenMetres(officerLocation, entry.location);
    return distanceMetres <= radiusMetres ? [{ ...entry, distanceMetres }] : [];
  });
}

export function circlePolygon(center: Coordinates, radiusMetres: number, steps = 80) {
  const latitudeRadians = degreesToRadians(center.latitude);
  const angularDistance = radiusMetres / earthRadiusMetres;
  const pointCount = Math.max(4, Math.floor(steps));
  const pointAtBearing = (bearing: number) => {
    const latitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance)
      + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const longitude = degreesToRadians(center.longitude) + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
      Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(latitude),
    );
    return [longitude * 180 / Math.PI, latitude * 180 / Math.PI];
  };
  const firstPoint = pointAtBearing(0);
  const coordinates = [
    firstPoint,
    ...Array.from({ length: pointCount - 1 }, (_, index) => pointAtBearing(2 * Math.PI * (index + 1) / pointCount)),
    firstPoint,
  ];

  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coordinates] },
  };
}

export const priorityColors: Record<HeatmapPriority, string> = {
  critical: "#c82b24",
  high: "#e56519",
  medium: "#d2a917",
  low: "#178d83",
};

export function formatDistance(distanceMetres: number): string {
  if (distanceMetres < 1_000) return `${Math.round(distanceMetres / 10) * 10} m away`;
  return `${(distanceMetres / 1_000).toFixed(1)} km away`;
}
