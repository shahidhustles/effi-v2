"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AttributionControl,
  Layer,
  Map,
  NavigationControl,
  Popup,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import { LocateFixed, MapPin, X } from "lucide-react";
import { caseStatusLabels } from "./case-inbox-state";
import {
  casePriorities,
  circlePolygon,
  formatDistance,
  heatmapRadiusMetres,
  popupAnchorForPoint,
  priorityColors,
  type Coordinates,
  type NearbyHeatmapCase,
  type PopupAnchor,
} from "./heatmap-state";

const mapStyle = "https://tiles.openfreemap.org/styles/positron";

const radiusFillLayer = {
  id: "officer-radius-fill",
  type: "fill",
  paint: { "fill-color": "#b7cee4", "fill-opacity": 0.18 },
} satisfies LayerProps;

const radiusOutlineLayer = {
  id: "officer-radius-outline",
  type: "line",
  paint: { "line-color": "#3f78ae", "line-width": 1.5, "line-dasharray": [3, 2] },
} satisfies LayerProps;

const accuracyFillLayer = {
  id: "officer-accuracy",
  type: "fill",
  paint: { "fill-color": "#174f88", "fill-opacity": 0.09 },
} satisfies LayerProps;

const haloLayer = {
  id: "case-halos",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 13, 34, 16, 52],
    "circle-color": [
      "match",
      ["get", "priority"],
      "critical", priorityColors.critical,
      "high", priorityColors.high,
      "medium", priorityColors.medium,
      priorityColors.low,
    ],
    "circle-opacity": 0.3,
    "circle-blur": 0.7,
  },
} satisfies LayerProps;

const pointLayer = {
  id: "case-points",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 13, 7, 16, 9],
    "circle-color": [
      "match",
      ["get", "priority"],
      "critical", priorityColors.critical,
      "high", priorityColors.high,
      "medium", priorityColors.medium,
      priorityColors.low,
    ],
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
} satisfies LayerProps;

const officerPointLayer = {
  id: "officer-point",
  type: "circle",
  paint: {
    "circle-radius": 8,
    "circle-color": "#174f88",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 3,
  },
} satisfies LayerProps;

const caseGeoJson = (cases: readonly NearbyHeatmapCase[]) => ({
  type: "FeatureCollection" as const,
  features: cases.map((entry) => ({
    type: "Feature" as const,
    id: entry.caseId,
    properties: { caseId: entry.caseId, priority: entry.currentPriority },
    geometry: {
      type: "Point" as const,
      coordinates: [entry.location.longitude, entry.location.latitude],
    },
  })),
});

const officerPointGeoJson = (location: Coordinates) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "Point" as const, coordinates: [location.longitude, location.latitude] },
});

type HeatmapMapProps = {
  cases: readonly NearbyHeatmapCase[];
  officerLocation: Coordinates;
  accuracyMetres: number;
  onLocate: () => void;
};

type SelectedCase = { caseId: string; anchor: PopupAnchor };

const priorityLabels = { critical: "Critical", high: "High", medium: "Medium", low: "Low" } as const;

export function HeatmapMap({ cases, officerLocation, accuracyMetres, onLocate }: HeatmapMapProps) {
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [hoveringCase, setHoveringCase] = useState(false);
  const caseLookup = useMemo(() => new globalThis.Map(cases.map((entry) => [entry.caseId, entry])), [cases]);
  const selectedEntry = selectedCase ? caseLookup.get(selectedCase.caseId) ?? null : null;
  const caseData = useMemo(() => caseGeoJson(cases), [cases]);
  const radiusData = useMemo(() => circlePolygon(officerLocation, heatmapRadiusMetres), [officerLocation]);
  const accuracyData = useMemo(
    () => circlePolygon(officerLocation, Number.isFinite(accuracyMetres) ? Math.max(accuracyMetres, 1) : 1),
    [accuracyMetres, officerLocation],
  );
  const officerData = useMemo(() => officerPointGeoJson(officerLocation), [officerLocation]);

  const selectCase = (event: MapLayerMouseEvent) => {
    const caseId = event.features?.[0]?.properties.caseId;
    if (typeof caseId !== "string" || !caseLookup.has(caseId)) return;
    const canvas = event.target.getCanvas();
    setSelectedCase({
      caseId,
      anchor: popupAnchorForPoint(event.point, { width: canvas.clientWidth, height: canvas.clientHeight }),
    });
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[#e9eef1]">
      <Map
        initialViewState={{
          latitude: officerLocation.latitude,
          longitude: officerLocation.longitude,
          zoom: 12.2,
        }}
        mapStyle={mapStyle}
        attributionControl={false}
        interactiveLayerIds={[pointLayer.id]}
        onClick={selectCase}
        onMouseEnter={() => setHoveringCase(true)}
        onMouseLeave={() => setHoveringCase(false)}
        onError={() => setMapFailed(true)}
        cursor={hoveringCase ? "pointer" : "grab"}
        reuseMaps
      >
        <Source id="officer-radius" type="geojson" data={radiusData}>
          <Layer {...radiusFillLayer} />
          <Layer {...radiusOutlineLayer} />
        </Source>
        <Source id="officer-accuracy" type="geojson" data={accuracyData}>
          <Layer {...accuracyFillLayer} />
        </Source>
        <Source id="heatmap-cases" type="geojson" data={caseData}>
          <Layer {...haloLayer} />
          <Layer {...pointLayer} />
        </Source>
        <Source id="officer-location" type="geojson" data={officerData}>
          <Layer {...officerPointLayer} />
        </Source>

        {selectedEntry && selectedCase ? <CasePopup entry={selectedEntry} anchor={selectedCase.anchor} onClose={() => setSelectedCase(null)} /> : null}
        <NavigationControl position="bottom-right" showCompass={false} />
        <AttributionControl position="bottom-right" compact />
      </Map>

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-4.25rem)] flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-surface/95 px-3 py-2.5 shadow-panel sm:left-4 sm:top-4 sm:px-4" aria-label="Heatmap legend">
        <p className="border-r border-line pr-4 text-xs font-bold text-ink" aria-live="polite">
          {cases.length} open {cases.length === 1 ? "case" : "cases"} within 5 km
        </p>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
          {casePriorities.map((priority) => (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-graphite" key={priority}>
              <span className="size-2 rounded-full" style={{ backgroundColor: priorityColors[priority] }} aria-hidden="true" />
              {priorityLabels[priority]}
            </span>
          ))}
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-12 z-10 mx-auto max-w-md rounded-md border border-line bg-surface/95 px-5 py-4 text-center shadow-panel backdrop-blur-sm">
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">No open cases nearby</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-graphite">There are no open cases within this 5 km area.</p>
        </div>
      ) : null}

      <button
        className="absolute bottom-[74px] right-[10px] z-10 grid size-[30px] place-items-center rounded border border-[#c7cdd1] bg-white text-ink shadow-sm transition-colors hover:bg-fog focus-visible:outline-2 active:scale-[0.96]"
        type="button"
        aria-label="Locate me"
        title="Locate me"
        onClick={onLocate}
      >
        <LocateFixed className="size-4" strokeWidth={1.8} />
      </button>

      {mapFailed ? (
        <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-4 rounded-md border border-[#d9b6b6] bg-[#fff8f7] px-4 py-3 text-sm text-danger shadow-panel sm:inset-x-4">
          <p>Some map tiles could not load. Check your connection and try again.</p>
          <button className="shrink-0 font-semibold underline underline-offset-4" type="button" onClick={() => window.location.reload()}>Retry</button>
        </div>
      ) : null}
    </div>
  );
}

function CasePopup({ entry, anchor, onClose }: { entry: NearbyHeatmapCase; anchor: PopupAnchor; onClose: () => void }) {
  return (
    <Popup
      className="effi-map-popup"
      longitude={entry.location.longitude}
      latitude={entry.location.latitude}
      anchor={anchor}
      offset={18}
      closeButton={false}
      closeOnClick={false}
      onClose={onClose}
      maxWidth="310px"
    >
      <article className="relative min-w-[240px] p-1 text-ink">
        <button className="absolute right-0 top-0 grid size-8 place-items-center rounded-md text-muted hover:bg-fog hover:text-ink" type="button" aria-label="Close case popup" onClick={onClose}>
          <X className="size-4" />
        </button>
        <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize text-white" style={{ backgroundColor: priorityColors[entry.currentPriority] }}>
          {entry.currentPriority}
        </span>
        <p className="mt-2 font-mono text-xs text-graphite">{entry.reportNumber}</p>
        <h2 className="mt-1.5 max-w-[24ch] pr-6 font-display text-[19px] font-semibold leading-[1.05] tracking-[-0.02em]">{entry.summary}</h2>
        <dl className="mt-3 grid gap-1.5 text-xs text-graphite">
          <div className="flex items-center gap-2"><MapPin className="size-3.5" /><dd>{formatDistance(entry.distanceMetres)}</dd></div>
          <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-action" /><dd>{caseStatusLabels[entry.status]}</dd></div>
        </dl>
        <Link className="mt-4 inline-flex font-semibold text-action underline decoration-action/35 underline-offset-4 hover:text-action-hover" href={`/cases/${entry.caseId}`}>
          Open case <span className="ml-1" aria-hidden="true">→</span>
        </Link>
      </article>
    </Popup>
  );
}
