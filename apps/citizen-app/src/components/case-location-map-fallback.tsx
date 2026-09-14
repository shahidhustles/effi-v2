import { MapPin } from "lucide-react-native";
import { Linking, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import type { CaseLocationMapProps } from "./case-location-map";
import { googleMapsLocationUrl } from "./case-location-map-url";

export function CaseLocationMapFallback({ latitude, longitude, label }: CaseLocationMapProps) {
  const surface = useColor("homeSurface");
  const border = useColor("homeBorder");
  const blue = useColor("submittedAccent");
  const muted = useColor("textMuted");
  const mapsUrl = googleMapsLocationUrl({ latitude, longitude });

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Open exact report location in Google Maps"
      onPress={() => void Linking.openURL(mapsUrl)}
      style={({ pressed }) => [styles.fallback, { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.72 : 1 }]}
    >
      <View style={[styles.pin, { backgroundColor: useColor("submittedTint") }]}> 
        <MapPin color={blue} size={24} strokeWidth={2.25} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Map preview unavailable</Text>
        <Text style={[styles.location, { color: muted }]}>{label ?? "Tap to open the exact location"}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 210,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  pin: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  location: {
    fontSize: 14,
  },
});
