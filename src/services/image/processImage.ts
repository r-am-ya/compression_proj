import type { CompressionPreset } from "@/config/presets";
import { imagePresets } from "@/config/presets";
import type { ExportStats, ImageEdits, MediaAsset } from "@/types/media";
import { computeReduction } from "@/utils/bytes";

type ImageProcessResult = {
  blob: Blob;
  stats: ExportStats;
  ext: "jpg" | "png";
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function computeTargetSize(args: {
  srcWidth: number;
  srcHeight: number;
  presetMaxWidth: number;
  resize?: ImageEdits["resize"];
  rotationDeg: number;
}) {
  const { srcWidth, srcHeight, presetMaxWidth, resize, rotationDeg } = args;

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  const requestedWidth = resize?.width ?? 0;
  const requestedHeight = resize?.height ?? 0;
  const keepAspectRatio = resize?.keepAspectRatio ?? true;

  if (requestedWidth > 0 || requestedHeight > 0) {
    if (requestedWidth > 0 && requestedHeight > 0) {
      targetWidth = requestedWidth;
      targetHeight = requestedHeight;
      if (keepAspectRatio) {
        const ratio = srcWidth / srcHeight;
        targetHeight = Math.round(targetWidth / ratio);
      }
    } else if (requestedWidth > 0) {
      targetWidth = requestedWidth;
      targetHeight = Math.round((srcHeight * targetWidth) / srcWidth);
    } else if (requestedHeight > 0) {
      targetHeight = requestedHeight;
      targetWidth = Math.round((srcWidth * targetHeight) / srcHeight);
    }
  } else {
    const maxWidth = Math.min(srcWidth, presetMaxWidth);
    targetWidth = maxWidth;
    targetHeight = Math.round((srcHeight * targetWidth) / srcWidth);
  }

  // Never upscale in MVP.
  if (targetWidth > srcWidth) {
    targetWidth = srcWidth;
    targetHeight = srcHeight;
  }

  // Rotation swaps target dimensions.
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360;
  if (normalizedRotation === 90 || normalizedRotation === 270) {
    return { canvasWidth: targetHeight, canvasHeight: targetWidth, drawWidth: targetWidth, drawHeight: targetHeight };
  }
  return { canvasWidth: targetWidth, canvasHeight: targetHeight, drawWidth: targetWidth, drawHeight: targetHeight };
}

export async function processImage(args: {
  asset: MediaAsset;
  edits: ImageEdits;
  preset: CompressionPreset;
}): Promise<ImageProcessResult> {
  const { asset, edits, preset } = args;
  const t0 = performance.now();

  const presetCfg = imagePresets[preset];
  const bitmap = await createImageBitmap(asset.file);

  const crop = edits.crop;
  const srcX = crop ? clampInt(crop.x, 0, bitmap.width - 1) : 0;
  const srcY = crop ? clampInt(crop.y, 0, bitmap.height - 1) : 0;
  const srcW = crop
    ? clampInt(crop.width, 1, bitmap.width - srcX)
    : bitmap.width;
  const srcH = crop
    ? clampInt(crop.height, 1, bitmap.height - srcY)
    : bitmap.height;

  const rotationDeg = edits.rotationDeg ?? 0;
  const { canvasWidth, canvasHeight, drawWidth, drawHeight } = computeTargetSize({
    srcWidth: srcW,
    srcHeight: srcH,
    presetMaxWidth: presetCfg.maxWidth,
    resize: edits.resize,
    rotationDeg,
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, canvasWidth);
  canvas.height = Math.max(1, canvasHeight);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Apply rotation in canvas space.
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360;
  if (normalizedRotation !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normalizedRotation * Math.PI) / 180);
    ctx.translate(-drawWidth / 2, -drawHeight / 2);
  }

  ctx.drawImage(bitmap, srcX, srcY, srcW, srcH, 0, 0, drawWidth, drawHeight);
  bitmap.close();

  const format = edits.outputFormat ?? presetCfg.format;
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const quality =
    mime === "image/jpeg"
      ? Math.min(0.95, Math.max(0.1, edits.quality ?? presetCfg.quality))
      : undefined;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to export image"))),
      mime,
      quality
    );
  });

  const t1 = performance.now();
  const { bytesSaved, reductionPct } = computeReduction(asset.sizeBytes, blob.size);

  const stats: ExportStats = {
    originalBytes: asset.sizeBytes,
    outputBytes: blob.size,
    bytesSaved,
    reductionPct,
    elapsedMs: Math.round(t1 - t0),
  };

  return { blob, stats, ext: format === "png" ? "png" : "jpg" };
}

