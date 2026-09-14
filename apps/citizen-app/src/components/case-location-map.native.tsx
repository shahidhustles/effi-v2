import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { CaseLocationMapFallback } from "./case-location-map-fallback";
import type { CaseLocationMapProps } from "./case-location-map";
import { googleMapsLocationUrl, openStreetMapEmbedUrl } from "./case-location-map-url";

export function CaseLocationMap({ latitude, longitude, label }: CaseLocationMapProps) {
  const [failed, setFailed] = useState(false);
  const canvas = useColor("homeCanvas");
  const muted = useColor("textMuted");
  const blue = useColor("submittedAccent");

  if (failed) {
    return <CaseLocationMapFallback latitude={latitude} longitude={longitude} {...(label ? { label } : {})} />;
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${label ?? "exact report location"} in Google Maps`}
      onPress={() => void Linking.openURL(googleMapsLocationUrl({ latitude, longitude }))}
      style={({ pressed }) => [styles.frame, { backgroundColor: canvas, opacity: pressed ? 0.82 : 1 }]}
    >
      <View pointerEvents="none" style={styles.mapContainer}>
        <WebView
          accessibilityLabel={label ? `${label} on OpenStreetMap` : "Reported location on OpenStreetMap"}
          onError={() => setFailed(true)}
          renderLoading={() => (
            <View style={[styles.loading, { backgroundColor: canvas }]}> 
              <ActivityIndicator color={blue} />
              <Text style={[styles.loadingText, { color: muted }]}>Loading map</Text>
            </View>
          )}
          scrollEnabled={false}
          setSupportMultipleWindows={false}
          source={{ uri: openStreetMapEmbedUrl({ latitude, longitude }) }}
          startInLoadingState
          style={styles.map}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 224,
    overflow: "hidden",
    borderRadius: 16,
  },
  mapContainer: { flex: 1 },
  map: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
