import type { MediaAsset, MediaKind } from "@/types/media";

export async function getImageDimensions(file: File): Promise<{
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}

export async function getVideoMetadata(objectUrl: string): Promise<{
  width: number;
  height: number;
  durationSec: number;
}> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = objectUrl;

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => resolve();
    const onError = () => reject(new Error("Failed to load video metadata"));
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
  });

  return {
    width: video.videoWidth,
    height: video.videoHeight,
    durationSec: video.duration || 0,
  };
}

export function sniffMediaKind(file: File): MediaKind | null {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return null;
}

export function isSupportedAsset(kind: MediaKind, file: File): boolean {
  const name = file.name.toLowerCase();
  if (kind === "image") return /\.(png|jpe?g|webp)$/.test(name);
  if (kind === "video") return /\.(mp4|mov|webm)$/.test(name);
  return false;
}

export async function buildAsset(file: File): Promise<MediaAsset> {
  const kind = sniffMediaKind(file);
  if (!kind) {
    throw new Error("Unsupported file type. Please upload an image or video.");
  }
  if (!isSupportedAsset(kind, file)) {
    throw new Error("Unsupported file extension for this media type.");
  }
  if (kind === "video" && file.size > 2 * 1024 * 1024 * 1024) {
    throw new Error("Video file is too large (max 2 GB).");
  }

  const objectUrl = URL.createObjectURL(file);
  const base: MediaAsset = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    file,
    kind,
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    objectUrl,
  };

  if (kind === "image") {
    const { width, height } = await getImageDimensions(file);
    return { ...base, width, height };
  }

  const { width, height, durationSec } = await getVideoMetadata(objectUrl);
  return { ...base, width, height, durationSec };
}
