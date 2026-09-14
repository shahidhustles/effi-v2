export const formatReportNumber = (reportNumber: string): string => {
  if (reportNumber.length <= 16) return reportNumber;
  const separator = reportNumber.indexOf("-");
  const prefix = separator >= 0 ? reportNumber.slice(0, separator + 1) : "";
  return `${prefix}…${reportNumber.slice(-6)}`;
};

export type DisplayLocation = {
  latitude: number;
  longitude: number;
  place?: { name: string; formattedAddress: string };
};

export const formatDisplayLocation = (location: DisplayLocation): string =>
  location.place?.name ?? "Pinned location";
