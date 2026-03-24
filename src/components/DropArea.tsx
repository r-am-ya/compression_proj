"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function DropArea(props: {
  disabled?: boolean;
  onFile: (file: File) => void | Promise<void>;
}) {
  const { disabled, onFile } = props;

  const onDrop = useCallback(
    async (files: File[]) => {
      const first = files[0];
      if (!first) return;
      await onFile(first);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    disabled,
    onDropAccepted: onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "video/*": [".mp4", ".mov", ".webm"],
    },
    // Hard cap requested: 2 GiB. Note: processing files this large in-browser
    // can still fail due to memory constraints.
    maxSize: 2 * 1024 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={[
        "group cursor-pointer select-none rounded-2xl border border-dashed p-5 text-left transition",
        "bg-white/60 ring-1 ring-black/5 hover:bg-white",
        disabled ? "cursor-not-allowed opacity-60" : "",
        isDragActive ? "border-zinc-950/60 bg-white" : "border-zinc-950/20",
      ].join(" ")}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-zinc-900">
          {isDragActive ? "Drop it" : "Drag and drop media"}
        </div>
        <div className="text-xs text-zinc-600">
          Images: PNG/JPG/WebP. Videos: MP4/MOV/WebM. Max 2 GB.
        </div>
        <div className="mt-2 text-xs font-medium text-zinc-900 underline decoration-zinc-900/20 underline-offset-4 group-hover:decoration-zinc-900/60">
          Or click to choose a file
        </div>
      </div>
    </div>
  );
}
