import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import type { MediaAsset } from "@/components/ui/media-picker";
import type { ReportLocation } from "@/report-draft";

const toMediaAsset = (asset: ImagePicker.ImagePickerAsset, fallbackId: string): MediaAsset => ({
  id: asset.assetId ?? fallbackId,
  uri: asset.uri,
  type: asset.type === "video" ? "video" : "image",
  ...(asset.width === undefined ? {} : { width: asset.width }),
  ...(asset.height === undefined ? {} : { height: asset.height }),
  ...(asset.fileName === null ? {} : { filename: asset.fileName }),
  ...(asset.fileSize === undefined ? {} : { fileSize: asset.fileSize }),
});

/** Captures the single report photo with the camera. Returns null when the camera is dismissed. */
export const captureReportPhoto = async (): Promise<MediaAsset | null> => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera access is required to photograph the issue.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset ? toMediaAsset(asset, `camera_${Date.now()}`) : null;
};

export const captureCurrentLocation = async (): Promise<ReportLocation> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("Location access is required to place the report.");
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    source: "current_gps",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
};

export const mediaTypeForAsset = (asset: MediaAsset): string => {
  const name = (asset.filename ?? asset.uri).toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
};

export type UploadedReportPhoto = { storageId: string; storageKey: string; mediaType: string };

export const uploadReportPhoto = async (uploadUrl: string, asset: MediaAsset): Promise<UploadedReportPhoto> => {
  const mediaType = mediaTypeForAsset(asset);
  const blob = await (await fetch(asset.uri)).blob();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mediaType },
    body: blob,
  });
  if (!response.ok) throw new Error("The photo upload failed. Try again.");
  const body: unknown = await response.json();
  const storageId = typeof body === "object" && body !== null && "storageId" in body
    ? (body as { storageId?: unknown }).storageId
    : undefined;
  if (typeof storageId !== "string") throw new Error("The photo upload returned no file id.");
  return { storageId, storageKey: `app/${storageId}`, mediaType };
};
