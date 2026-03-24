export type MediaKind = "image" | "video";

export type MediaAsset = {
  id: string;
  file: File;
  kind: MediaKind;
  name: string;
  sizeBytes: number;
  mimeType: string;
  objectUrl: string;
  width?: number;
  height?: number;
  durationSec?: number;
};

export type ImageEdits = {
  crop?: { x: number; y: number; width: number; height: number };
  resize?: { width: number; height: number; keepAspectRatio: boolean };
  rotationDeg?: 0 | 90 | 180 | 270;
  outputFormat: "jpeg" | "png";
  quality?: number;
};

export type VideoEdits = {
  trim?: { startSec: number; endSec: number };
  outputFormat: "mp4";
};

export type ExportStats = {
  originalBytes: number;
  outputBytes: number;
  bytesSaved: number;
  reductionPct: number;
  elapsedMs: number;
};

