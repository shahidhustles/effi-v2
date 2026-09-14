import { describe, expect, it } from "vitest";
import { googleMapsLocationUrl, openStreetMapEmbedUrl, openStreetMapLocationUrl } from "./case-location-map-url";

const location = { latitude: 12.9716, longitude: 77.5946 };

describe("OpenStreetMap URLs", () => {
  it("centres the embedded map and marker on the report", () => {
    const url = new URL(openStreetMapEmbedUrl(location));

    expect(url.origin).toBe("https://www.openstreetmap.org");
    expect(url.pathname).toBe("/export/embed.html");
    expect(url.searchParams.get("layer")).toBe("mapnik");
    expect(url.searchParams.get("marker")).toBe("12.9716,77.5946");
    const bounds = url.searchParams.get("bbox")?.split(",").map(Number);
    expect(bounds).toHaveLength(4);
    expect(bounds?.[1]).toBeCloseTo(12.970702, 6);
    expect(bounds?.[3]).toBeCloseTo(12.972498, 6);
    expect(bounds?.[0]).toBeCloseTo(77.593678, 6);
    expect(bounds?.[2]).toBeCloseTo(77.595522, 6);
  });

  it("builds the full OpenStreetMap fallback link", () => {
    expect(openStreetMapLocationUrl(location)).toBe(
      "https://www.openstreetmap.org/?mlat=12.9716&mlon=77.5946#map=19/12.9716/77.5946",
    );
  });

  it("builds a Google Maps link without an API key", () => {
    expect(googleMapsLocationUrl(location)).toBe(
      "https://www.google.com/maps/search/?api=1&query=12.9716%2C77.5946",
    );
  });
});
