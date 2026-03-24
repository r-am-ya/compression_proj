export type CompressionPreset = "low" | "medium" | "high";

export const imagePresets = {
  low: { maxWidth: 1280, quality: 0.55, format: "jpeg" as const },
  medium: { maxWidth: 1920, quality: 0.72, format: "jpeg" as const },
  high: { maxWidth: 2560, quality: 0.85, format: "jpeg" as const },
} as const;

export const videoPresets = {
  low: { width: 640, bitrateKbps: 700 },
  medium: { width: 1280, bitrateKbps: 1500 },
  high: { width: 1920, bitrateKbps: 3000 },
} as const;

