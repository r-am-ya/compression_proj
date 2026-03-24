"use client";

import type { MediaAsset } from "@/types/media";
import { formatBytes } from "@/utils/bytes";

export default function MediaPreview(props: { asset: MediaAsset | null }) {
  const { asset } = props;

  if (!asset) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-black/10">
        <p className="text-sm font-semibold text-zinc-900">No file loaded</p>
        <p className="mt-1 text-xs text-zinc-600">
          Drop an image or video to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{asset.name}</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            {asset.kind.toUpperCase()} · {formatBytes(asset.sizeBytes)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {asset.durationSec ? ` · ${asset.durationSec.toFixed(2)}s` : ""}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-800">
          {asset.mimeType || "unknown"}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl ring-1 ring-black/10">
        {asset.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.objectUrl}
            alt={asset.name}
            className="max-h-[420px] w-full object-contain bg-zinc-950/5"
          />
        ) : (
          <video
            src={asset.objectUrl}
            className="max-h-[420px] w-full bg-black object-contain"
            controls
            playsInline
          />
        )}
      </div>
    </div>
  );
}

