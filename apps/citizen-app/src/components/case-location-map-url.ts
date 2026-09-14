type MapCoordinate = { latitude: number; longitude: number };

export const openStreetMapEmbedUrl = ({ latitude, longitude }: MapCoordinate): string => {
  const radiusMetres = 100;
  const metresPerDegree = 111_320;
  const latitudeDelta = radiusMetres / metresPerDegree;
  const longitudeDelta = radiusMetres / (metresPerDegree * Math.cos(latitude * Math.PI / 180));
  const bounds = [
    longitude - longitudeDelta,
    latitude - latitudeDelta,
    longitude + longitudeDelta,
    latitude + latitudeDelta,
  ].map((value) => value.toFixed(6)).join(",");
  const marker = `${latitude},${longitude}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bounds)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
};

export const openStreetMapLocationUrl = ({ latitude, longitude }: MapCoordinate): string =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=19/${latitude}/${longitude}`;

export const googleMapsLocationUrl = ({ latitude, longitude }: MapCoordinate): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
