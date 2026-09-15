"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LoaderCircle, MapPinOff } from "lucide-react";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Button } from "@effi/ui-web";
import { OfficerShell } from "./officer-shell";
import {
  nearbyHeatmapCases,
  type Coordinates,
  type HeatmapCase,
} from "./heatmap-state";

const HeatmapMap = dynamic(
  () => import("./heatmap-map").then((module) => module.HeatmapMap),
  {
    ssr: false,
    loading: () => <MapLoading label="Loading the map" />,
  },
);

const listHeatmapCases = makeFunctionReference<"query", Record<string, never>, HeatmapCase[]>("cases:listHeatmapCases");

type LocationState =
  | { kind: "locating" }
  | { kind: "ready"; coordinates: Coordinates; accuracyMetres: number }
  | { kind: "failed"; message: string };

function geolocationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return "Location access is blocked. Allow it in your browser settings, then try again.";
  if (error.code === error.POSITION_UNAVAILABLE) return "Your browser could not determine your location. Check location services and try again.";
  return "Finding your location took too long. Move somewhere with a clearer signal and try again.";
}

function requestBrowserLocation(
  onSuccess: PositionCallback,
  onFailure: PositionErrorCallback,
): void {
  if (!navigator.geolocation) {
    queueMicrotask(() => onFailure({
      code: 2,
      message: "This browser does not provide location access.",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    onSuccess,
    onFailure,
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
  );
}

function MapLoading({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center bg-[#edf1f2]" role="status">
      <div className="grid justify-items-center gap-3 text-graphite">
        <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

function MapMessage({ icon, title, message, action }: { icon: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="grid h-full content-center justify-items-start bg-surface p-[clamp(1.5rem,5vw,4rem)]">
      <div className="grid size-11 place-items-center rounded-full bg-lavender text-action">{icon}</div>
      <h2 className="mt-5 font-display text-[clamp(2rem,4vw,3.25rem)] font-medium leading-none tracking-[-0.04em] text-ink">{title}</h2>
      <p className="mt-4 max-w-[52ch] leading-relaxed text-graphite">{message}</p>
      {action}
    </div>
  );
}

export function HeatmapPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const queryResult = useQuery_experimental({ query: listHeatmapCases, args: isAuthenticated && !authLoading ? {} : "skip" });
  const [location, setLocation] = useState<LocationState>({ kind: "locating" });

  const acceptPosition = useCallback((position: GeolocationPosition) => setLocation({
    kind: "ready",
    coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    accuracyMetres: position.coords.accuracy,
  }), []);
  const rejectLocation = useCallback((error: GeolocationPositionError) => setLocation({
    kind: "failed",
    message: error.message === "This browser does not provide location access." ? error.message : geolocationMessage(error),
  }), []);

  const locate = useCallback(() => {
    setLocation({ kind: "locating" });
    requestBrowserLocation(acceptPosition, rejectLocation);
  }, [acceptPosition, rejectLocation]);

  useEffect(() => requestBrowserLocation(acceptPosition, rejectLocation), [acceptPosition, rejectLocation]);

  let mapContent: ReactNode;
  if (!authLoading && !isAuthenticated) {
    mapContent = <MapMessage icon={<MapPinOff className="size-5" />} title="We could not verify your officer session" message="Sign out and sign in again, then return to the heatmap." />;
  } else if (queryResult.status === "error") {
    const denied = queryResult.error.message.toLowerCase().includes("officer");
    mapContent = <MapMessage
      icon={<MapPinOff className="size-5" />}
      title={denied ? "This account is not an officer" : "We could not load nearby cases"}
      message={denied ? "Ask an Effi admin to grant the officer role, then reload this page." : "The connection to Convex failed. Check the deployment and try again."}
    />;
  } else if (location.kind === "failed") {
    mapContent = <MapMessage
      icon={<MapPinOff className="size-5" />}
      title="We need your location"
      message={location.message}
      action={<Button className="mt-6" onClick={locate}>Retry location</Button>}
    />;
  } else if (location.kind === "locating") {
    mapContent = <MapLoading label="Finding your location" />;
  } else if (queryResult.status !== "success") {
    mapContent = <MapLoading label="Loading nearby cases" />;
  } else {
    const nearbyCases = nearbyHeatmapCases(queryResult.data, location.coordinates);
    mapContent = <HeatmapMap
      key={`${location.coordinates.latitude}:${location.coordinates.longitude}`}
      cases={nearbyCases}
      officerLocation={location.coordinates}
      accuracyMetres={location.accuracyMetres}
      onLocate={locate}
    />;
  }

  return (
    <OfficerShell activeNav="heatmap" contentMode="full-bleed">
      <section className="h-full" aria-labelledby="heatmap-title">
        <h1 className="sr-only" id="heatmap-title">Heatmap</h1>
        {mapContent}
      </section>
    </OfficerShell>
  );
}
