import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import type { NearbyIssuesMapProps } from "./nearby-issues-map";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const buildMapHtml = ({
  latitude,
  longitude,
  radiusMetres,
  heatPoints,
}: NearbyIssuesMapProps): string => {
  const latitudeDelta = radiusMetres / 111_320;
  const longitudeDelta =
    radiusMetres / (111_320 * Math.cos((latitude * Math.PI) / 180));
  const minimumLatitude = latitude - latitudeDelta;
  const maximumLatitude = latitude + latitudeDelta;
  const minimumLongitude = longitude - longitudeDelta;
  const maximumLongitude = longitude + longitudeDelta;
  const bbox = [
    minimumLongitude,
    minimumLatitude,
    maximumLongitude,
    maximumLatitude,
  ].join(",");
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
  const heat = heatPoints
    .map((point) => {
      const left =
        ((point.longitude - minimumLongitude) /
          (maximumLongitude - minimumLongitude)) *
        100;
      const top =
        ((maximumLatitude - point.latitude) /
          (maximumLatitude - minimumLatitude)) *
        100;
      const size = Math.min(126, 74 + point.weight * 13);
      const opacity = Math.min(0.78, 0.38 + point.weight * 0.1);
      return `<span class="heat" style="left:${left.toFixed(3)}%;top:${top.toFixed(3)}%;width:${size}px;height:${size}px;opacity:${opacity}"></span>`;
    })
    .join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#eef2f6}.map{position:absolute;inset:0;border:0;width:100%;height:100%;pointer-events:none;filter:saturate(.72) contrast(.92) brightness(1.07)}
    .veil{position:absolute;inset:0;background:rgba(247,249,252,.12);pointer-events:none}.heat{position:absolute;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(234,67,53,.92) 0%,rgba(255,84,62,.62) 25%,rgba(255,106,82,.28) 52%,rgba(255,106,82,0) 74%)}
    .me{position:absolute;left:50%;top:50%;width:42px;height:42px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(0,111,237,.17);display:grid;place-items:center}.me:after{content:"";width:15px;height:15px;border:3px solid white;border-radius:50%;background:#006fed;box-shadow:0 1px 5px rgba(0,50,110,.35)}
  </style></head><body><iframe class="map" tabindex="-1" src="${escapeHtml(mapUrl)}"></iframe><div class="veil"></div>${heat}<div class="me"></div></body></html>`;
};

export function NearbyIssuesMap(props: NearbyIssuesMapProps) {
  const border = useColor("homeBorder");
  const html = useMemo(() => buildMapHtml(props), [props]);
  return (
    <View
      accessible
      accessibilityLabel={`Map showing ${props.heatPoints.length} nearby problem areas and your current location`}
      style={[styles.frame, { borderColor: border }]}
    >
      <WebView
        accessible={false}
        bounces={false}
        javaScriptEnabled
        originWhitelist={["*"]}
        scrollEnabled={false}
        source={{ html, baseUrl: "https://www.openstreetmap.org" }}
        style={styles.map}
      />
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
  map: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
