import type { MediaAsset } from "@/types/media";
import type { CompressionPreset } from "@/config/presets";

export function recommendPreset(asset: MediaAsset): CompressionPreset {
  if (asset.kind === "image") {
    if (asset.sizeBytes > 5 * 1024 * 1024) return "low";
    if (asset.sizeBytes > 2 * 1024 * 1024) return "medium";
    return "high";
  }

  if ((asset.durationSec ?? 0) > 120) return "low";
  if ((asset.width ?? 0) > 1920) return "medium";
  return "high";
}

