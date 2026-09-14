import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { reportPlaceFromGeocode } from "@/location-place";
import type { DisplayLocation } from "@/report-display";

export type ReadableLocationState =
  | { kind: "ready"; label: string }
  | { kind: "loading"; label: "Finding place…" }
  | { kind: "unavailable"; label: "Location unavailable" };

const geocodeCache = new Map<string, Promise<string | null>>();
let geocodeQueue: Promise<void> = Promise.resolve();

const coordinateKey = (location: DisplayLocation): string =>
  `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;

const enqueueReverseGeocode = (
  location: DisplayLocation,
): Promise<string | null> => {
  const key = coordinateKey(location);
  const existing = geocodeCache.get(key);
  if (existing) return existing;

  const request = geocodeQueue
    .then(async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return null;
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      return reportPlaceFromGeocode(addresses[0])?.name ?? null;
    })
    .catch(() => null);
  geocodeQueue = request.then(() => undefined);
  geocodeCache.set(key, request);
  return request;
};

export function useReadableLocation(
  location: DisplayLocation | null,
): ReadableLocationState {
  const storedName = location?.place?.name;
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const key = location ? coordinateKey(location) : null;
  const [resolved, setResolved] = useState<{
    key: string;
    label: string | null;
  } | null>(null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    if (storedName) return;
    const coordinates = { latitude, longitude };
    let active = true;
    void enqueueReverseGeocode(coordinates).then((label) => {
      if (!active) return;
      setResolved({ key: coordinateKey(coordinates), label });
    });
    return () => {
      active = false;
    };
  }, [latitude, longitude, storedName]);

  if (storedName) return { kind: "ready", label: storedName };
  if (key && resolved?.key === key) {
    return resolved.label
      ? { kind: "ready", label: resolved.label }
      : { kind: "unavailable", label: "Location unavailable" };
  }
  return { kind: "loading", label: "Finding place…" };
}
