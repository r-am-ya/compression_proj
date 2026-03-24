"use client";

import { create } from "zustand";
import type { CompressionPreset } from "@/config/presets";
import type { ExportStats, ImageEdits, MediaAsset, VideoEdits } from "@/types/media";

export type ProcessingStatus =
  | "idle"
  | "loading-engine"
  | "processing"
  | "done"
  | "error";

type ProcessingState = {
  status: ProcessingStatus;
  progress: number; // 0..1
  detail?: string;
  error?: string;
};

type OutputState = {
  blob: Blob | null;
  url: string | null;
  filename: string | null;
  stats: ExportStats | null;
};

type StoreState = {
  asset: MediaAsset | null;
  preset: CompressionPreset;
  imageEdits: ImageEdits;
  videoEdits: VideoEdits;
  processing: ProcessingState;
  output: OutputState;

  setAsset: (asset: MediaAsset | null) => void;
  setPreset: (preset: CompressionPreset) => void;
  setImageEdits: (patch: Partial<ImageEdits>) => void;
  setVideoEdits: (patch: Partial<VideoEdits>) => void;
  setCrop: (crop: ImageEdits["crop"] | undefined) => void;
  setProcessing: (patch: Partial<ProcessingState>) => void;
  setOutput: (out: Partial<OutputState>) => void;
  resetOutput: () => void;
  resetAll: () => void;
};

const defaultImageEdits: ImageEdits = {
  outputFormat: "jpeg",
  quality: 0.72,
  rotationDeg: 0,
  resize: { width: 0, height: 0, keepAspectRatio: true },
};

const defaultVideoEdits: VideoEdits = {
  outputFormat: "mp4",
  trim: { startSec: 0, endSec: 0 },
};

const defaultProcessing: ProcessingState = {
  status: "idle",
  progress: 0,
};

const defaultOutput: OutputState = {
  blob: null,
  url: null,
  filename: null,
  stats: null,
};

export const useSmpStore = create<StoreState>((set, get) => ({
  asset: null,
  preset: "medium",
  imageEdits: defaultImageEdits,
  videoEdits: defaultVideoEdits,
  processing: defaultProcessing,
  output: defaultOutput,

  setAsset: (asset) => {
    const prev = get().asset;
    if (prev?.objectUrl && prev.objectUrl !== asset?.objectUrl) {
      URL.revokeObjectURL(prev.objectUrl);
    }
    set({ asset });
  },
  setPreset: (preset) => set({ preset }),
  setImageEdits: (patch) =>
    set((s) => ({ imageEdits: { ...s.imageEdits, ...patch } })),
  setVideoEdits: (patch) =>
    set((s) => ({ videoEdits: { ...s.videoEdits, ...patch } })),
  setCrop: (crop) => set((s) => ({ imageEdits: { ...s.imageEdits, crop } })),
  setProcessing: (patch) =>
    set((s) => ({ processing: { ...s.processing, ...patch } })),
  setOutput: (out) => {
    const prevUrl = get().output.url;
    if (prevUrl && out.url && prevUrl !== out.url) URL.revokeObjectURL(prevUrl);
    set((s) => ({ output: { ...s.output, ...out } }));
  },
  resetOutput: () => {
    const prevUrl = get().output.url;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({ output: defaultOutput, processing: defaultProcessing });
  },
  resetAll: () => {
    const prevAsset = get().asset;
    if (prevAsset?.objectUrl) URL.revokeObjectURL(prevAsset.objectUrl);
    const prevUrl = get().output.url;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({
      asset: null,
      preset: "medium",
      imageEdits: defaultImageEdits,
      videoEdits: defaultVideoEdits,
      processing: defaultProcessing,
      output: defaultOutput,
    });
  },
}));

