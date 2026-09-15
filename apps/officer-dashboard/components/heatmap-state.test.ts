import { describe, expect, it } from "vitest";
import {
  circlePolygon,
  distanceBetweenMetres,
  formatDistance,
  heatmapRadiusMetres,
  nearbyHeatmapCases,
  popupAnchorForPoint,
  type HeatmapCase,
} from "./heatmap-state";

const origin = { latitude: 0, longitude: 0 };
const caseAt = (caseId: string, latitude: number): HeatmapCase => ({
  caseId,
  reportNumber: `RPT-${caseId}`,
  summary: "Blocked drain",
  status: "new",
  currentPriority: "high",
  location: { latitude, longitude: 0 },
  submittedAt: 1,
});

describe("heatmap geography", () => {
  it("calculates straight-line geographic distance", () => {
    expect(distanceBetweenMetres(origin, { latitude: 0.008_993, longitude: 0 })).toBeCloseTo(1_000, -1);
  });

  it("keeps cases inside and exactly on the five kilometre boundary", () => {
    const boundaryLatitude = heatmapRadiusMetres / 6_371_000 * 180 / Math.PI;
    const nearby = nearbyHeatmapCases([
      caseAt("inside", boundaryLatitude - 0.000_001),
      caseAt("boundary", boundaryLatitude),
      caseAt("outside", boundaryLatitude + 0.000_001),
    ], origin);

    expect(nearby.map((entry) => entry.caseId)).toEqual(["inside", "boundary"]);
  });

  it("returns no cases for invalid officer coordinates or an empty input", () => {
    expect(nearbyHeatmapCases([], origin)).toEqual([]);
    expect(nearbyHeatmapCases([caseAt("nearby", 0)], { latitude: 91, longitude: 0 })).toEqual([]);
  });

  it("creates closed polygons for map radius layers", () => {
    const polygon = circlePolygon(origin, heatmapRadiusMetres, 8);
    expect(polygon.geometry.coordinates[0]).toHaveLength(9);
    expect(polygon.geometry.coordinates[0]?.[0]).toEqual(polygon.geometry.coordinates[0]?.[8]);
  });

  it("formats distances for popups", () => {
    expect(formatDistance(842)).toBe("840 m away");
    expect(formatDistance(1_840)).toBe("1.8 km away");
  });

  it("places popups inward from every viewport edge", () => {
    const viewport = { width: 1_000, height: 600 };
    expect(popupAnchorForPoint({ x: 20, y: 20 }, viewport)).toBe("top-left");
    expect(popupAnchorForPoint({ x: 980, y: 20 }, viewport)).toBe("top-right");
    expect(popupAnchorForPoint({ x: 20, y: 580 }, viewport)).toBe("bottom-left");
    expect(popupAnchorForPoint({ x: 980, y: 580 }, viewport)).toBe("bottom-right");
    expect(popupAnchorForPoint({ x: 500, y: 300 }, viewport)).toBe("bottom");
  });
});
