import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { reportPlaceFromGeocode } from "@/report-draft";

type NearbyLocationState =
  | { kind: "locating" }
  | { kind: "ready"; latitude: number; longitude: number; placeLabel: string }
  | { kind: "denied"; canAskAgain: boolean }
  | { kind: "error"; message: string };

export function useNearbyLocation(): {
  state: NearbyLocationState;
  refresh: () => Promise<void>;
} {
  const requestSequence = useRef(0);
  const [state, setState] = useState<NearbyLocationState>({ kind: "locating" });

  const refresh = useCallback(async () => {
    const request = requestSequence.current + 1;
    requestSequence.current = request;
    setState({ kind: "locating" });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (request !== requestSequence.current) return;
      if (!permission.granted) {
        setState({ kind: "denied", canAskAgain: permission.canAskAgain });
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let placeLabel = "Current location";
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        placeLabel = reportPlaceFromGeocode(addresses[0])?.name ?? placeLabel;
      } catch {
        // Coordinates still allow nearby search when the convenience label fails.
      }
      if (request !== requestSequence.current) return;
      setState({
        kind: "ready",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        placeLabel,
      });
    } catch {
      if (request !== requestSequence.current) return;
      setState({
        kind: "error",
        message: "We couldn't find your current location.",
      });
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(timeout);
      requestSequence.current += 1;
    };
  }, [refresh]);

  return { state, refresh };
}
