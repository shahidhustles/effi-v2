import Svg, { Circle, Path } from "react-native-svg";
import { StyleSheet } from "react-native";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import type { NearbyIssuesMapProps } from "./nearby-issues-map";

const toPlotPoint = (
  point: { latitude: number; longitude: number },
  center: { latitude: number; longitude: number },
) => ({
  x: 180 + (point.longitude - center.longitude) * 4_800,
  y: 150 - (point.latitude - center.latitude) * 4_800,
});

export function NearbyIssuesMap({
  latitude,
  longitude,
  heatPoints,
}: NearbyIssuesMapProps) {
  const border = useColor("homeBorder");
  const canvas = useColor("homeCanvas");
  const blue = useColor("submittedAccent");
  const red = useColor("red");
  const center = { latitude, longitude };
  return (
    <View
      accessible
      accessibilityLabel={`Map preview showing ${heatPoints.length} nearby problem areas and your current location`}
      style={[styles.frame, { backgroundColor: canvas, borderColor: border }]}
    >
      <Svg height="100%" viewBox="0 0 360 300" width="100%">
        <Path
          d="M-20 72 C70 42 126 108 202 82 S324 38 392 58"
          fill="none"
          stroke={border}
          strokeWidth="3"
        />
        <Path
          d="M44 -20 C72 70 42 132 82 196 S148 262 126 330"
          fill="none"
          stroke={border}
          strokeWidth="4"
        />
        <Path
          d="M236 -20 C212 54 248 116 222 176 S214 250 254 330"
          fill="none"
          stroke={border}
          strokeWidth="3"
        />
        <Path
          d="M-20 222 C76 190 136 238 214 214 S312 172 390 204"
          fill="none"
          stroke={border}
          strokeWidth="3"
        />
        {heatPoints.map((point) => {
          const plot = toPlotPoint(point, center);
          return (
            <Circle
              key={`${point.latitude}:${point.longitude}`}
              cx={plot.x}
              cy={plot.y}
              fill={red}
              opacity={Math.min(0.52, 0.2 + point.weight * 0.08)}
              r={24 + Math.min(point.weight, 4) * 5}
            />
          );
        })}
        <Circle cx="180" cy="150" fill={blue} opacity="0.18" r="22" />
        <Circle
          cx="180"
          cy="150"
          fill={blue}
          r="8"
          stroke="white"
          strokeWidth="3"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 330,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 20,
  },
});
