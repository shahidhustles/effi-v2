import { describe, expect, it } from "vitest";
import {
  MAX_REPORT_IMAGE_BYTES,
  MAX_REPORT_VIDEO_BYTES,
  selectedReportMedia,
} from "./report-media";

describe("selectedReportMedia", () => {
  it("normalizes an image selected from the library", () => {
    expect(
      selectedReportMedia({
        uri: "file:///issue.jpg",
        type: "image",
        fileName: "issue.jpg",
        fileSize: 1024,
        mimeType: "image/jpeg",
        width: 1200,
        height: 900,
      }),
    ).toEqual({
      uri: "file:///issue.jpg",
      kind: "image",
      fileName: "issue.jpg",
      sizeBytes: 1024,
      mediaType: "image/jpeg",
    });
  });

  it("rejects oversized images and videos", () => {
    const asset = {
      uri: "file:///large.mp4",
      type: "video" as const,
      width: 1920,
      height: 1080,
      duration: 8_000,
      fileName: "large.mp4",
      mimeType: "video/mp4",
    };
    expect(() =>
      selectedReportMedia({ ...asset, fileSize: MAX_REPORT_VIDEO_BYTES + 1 }),
    ).toThrow(/25 MB/);
    expect(() =>
      selectedReportMedia({
        ...asset,
        type: "image",
        mimeType: "image/jpeg",
        fileSize: MAX_REPORT_IMAGE_BYTES + 1,
      }),
    ).toThrow(/10 MB/);
  });
});
