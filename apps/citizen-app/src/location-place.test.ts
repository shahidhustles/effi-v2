import { describe, expect, it } from "vitest";
import { reportPlaceFromGeocode } from "./location-place";

describe("reportPlaceFromGeocode", () => {
  it("composes a stable place label and address", () => {
    expect(
      reportPlaceFromGeocode({
        name: "Bukit Bintang",
        district: "Bukit Bintang",
        city: "Kuala Lumpur",
        streetNumber: "12",
        street: "Jalan Mawar",
        region: "Kuala Lumpur",
        subregion: null,
        country: "Malaysia",
        postalCode: "55100",
        formattedAddress: null,
      }),
    ).toEqual({
      name: "Bukit Bintang, Kuala Lumpur",
      formattedAddress:
        "12 Jalan Mawar, Bukit Bintang, Kuala Lumpur, Kuala Lumpur 55100, Malaysia",
    });
  });

  it("returns null when no usable label or address exists", () => {
    expect(reportPlaceFromGeocode(undefined)).toBeNull();
    expect(
      reportPlaceFromGeocode({
        name: null,
        district: null,
        city: null,
        streetNumber: null,
        street: null,
        region: null,
        subregion: null,
        country: null,
        postalCode: null,
        formattedAddress: null,
      }),
    ).toBeNull();
  });
});
