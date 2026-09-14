import type { HeatPoint } from "@/nearby-issues";

export type NearbyIssuesMapProps = {
  latitude: number;
  longitude: number;
  radiusMetres: number;
  heatPoints: readonly HeatPoint[];
};

export declare function NearbyIssuesMap(
  props: NearbyIssuesMapProps,
): import("react").ReactNode;
