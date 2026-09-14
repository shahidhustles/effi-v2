import { CaseLocationMapFallback } from "./case-location-map-fallback";
import type { CaseLocationMapProps } from "./case-location-map";

export function CaseLocationMap(props: CaseLocationMapProps) {
  return <CaseLocationMapFallback {...props} />;
}
