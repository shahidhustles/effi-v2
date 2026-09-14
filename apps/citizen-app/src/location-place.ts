export type ReportPlace = { name: string; formattedAddress: string };

type GeocodedAddress = {
  city: string | null;
  district: string | null;
  streetNumber: string | null;
  street: string | null;
  region: string | null;
  subregion: string | null;
  country: string | null;
  postalCode: string | null;
  name: string | null;
  formattedAddress: string | null;
};

const cleanAddressPart = (value: string | null): string | null => {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
};

const limitText = (value: string, maximumLength: number): string =>
  value.length <= maximumLength
    ? value
    : value.slice(0, maximumLength).trimEnd();

const uniqueAddressParts = (values: readonly (string | null)[]): string[] => {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const cleaned = cleanAddressPart(value);
    if (!cleaned) return [];
    const key = cleaned.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [cleaned];
  });
};

export const reportPlaceFromGeocode = (
  address: GeocodedAddress | undefined,
): ReportPlace | null => {
  if (!address) return null;
  const streetLine = uniqueAddressParts([
    address.streetNumber,
    address.street,
  ]).join(" ");
  const regionLine = uniqueAddressParts([
    address.region,
    address.postalCode,
  ]).join(" ");
  const composedAddress = uniqueAddressParts([
    streetLine || null,
    address.district,
    address.city,
    address.subregion,
    regionLine || null,
    address.country,
  ]).join(", ");
  const formattedAddress =
    cleanAddressPart(address.formattedAddress) ?? composedAddress;
  const primaryName = uniqueAddressParts([
    address.name,
    address.district,
    address.city,
    address.subregion,
    address.region,
    address.country,
  ])[0];
  const city = cleanAddressPart(address.city);
  const name =
    primaryName &&
    city &&
    primaryName.toLocaleLowerCase() !== city.toLocaleLowerCase()
      ? `${primaryName}, ${city}`
      : primaryName;
  return name && formattedAddress
    ? {
        name: limitText(name, 160),
        formattedAddress: limitText(formattedAddress, 320),
      }
    : null;
};
