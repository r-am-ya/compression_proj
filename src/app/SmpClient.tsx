"use client";

import { useCallback, useMemo, useState } from "react";
import type { CompressionPreset } from "@/config/presets";
import { imagePresets, videoPresets } from "@/config/presets";
import DropArea from "@/components/DropArea";
import MediaPreview from "@/components/MediaPreview";
import PresetPicker from "@/components/PresetPicker";
import ImageCropperFabric from "@/components/ImageCropperFabric";
import ProcessingBar from "@/components/ProcessingBar";
import { buildOutputName } from "@/utils/filename";
import { formatBytes } from "@/utils/bytes";
import { useSmpStore } from "@/stores/smpStore";
import { recommendPreset } from "@/services/recommendPreset";
import { processImage } from "@/services/image/processImage";
import { processVideo } from "@/services/video/processVideo";
import { buildAsset } from "@/services/media/metadata";
import { formatError } from "@/utils/formatError";

export default function SmpClient() {
  const asset = useSmpStore((s) => s.asset);
  const preset = useSmpStore((s) => s.preset);
  const imageEdits = useSmpStore((s) => s.imageEdits);
  const videoEdits = useSmpStore((s) => s.videoEdits);
  const processing = useSmpStore((s) => s.processing);
  const output = useSmpStore((s) => s.output);

  const setAsset = useSmpStore((s) => s.setAsset);
  const setPreset = useSmpStore((s) => s.setPreset);
  const setImageEdits = useSmpStore((s) => s.setImageEdits);
  const setVideoEdits = useSmpStore((s) => s.setVideoEdits);
  const setProcessing = useSmpStore((s) => s.setProcessing);
  const setOutput = useSmpStore((s) => s.setOutput);
  const resetAll = useSmpStore((s) => s.resetAll);
  const resetOutput = useSmpStore((s) => s.resetOutput);

  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = processing.status === "loading-engine" || processing.status === "processing";

  const presetLabel = useMemo(() => {
    if (!asset) return "medium";
    if (asset.kind === "image") {
      const cfg = imagePresets[preset];
      return `${preset} (max ${cfg.maxWidth}px, q ${cfg.quality})`;
    }
    const cfg = videoPresets[preset];
    return `${preset} (${cfg.width}px, ${cfg.bitrateKbps} kbps)`;
  }, [asset, preset]);

  const onPickPreset = useCallback(
    (p: CompressionPreset) => {
      setPreset(p);
      if (!asset) return;
      if (asset.kind === "image") {
        const cfg = imagePresets[p];
        setImageEdits({ outputFormat: cfg.format, quality: cfg.quality });
      }
    },
    [asset, setImageEdits, setPreset]
  );

  const onDropFile = useCallback(
    async (file: File) => {
      setLocalError(null);
      resetAll();
      try {
        const built = await buildAsset(file);
        setAsset(built);
        const rec = recommendPreset(built);
        setPreset(rec);
        resetOutput();

        if (built.kind === "image") {
          const cfg = imagePresets[rec];
          setImageEdits({
            outputFormat: cfg.format,
            quality: cfg.quality,
            rotationDeg: 0,
            resize: { width: 0, height: 0, keepAspectRatio: true },
            crop: undefined,
          });
        } else {
          setVideoEdits({
            trim: { startSec: 0, endSec: built.durationSec ?? 0 },
            outputFormat: "mp4",
          });
        }
      } catch (e) {
        setLocalError(formatError(e));
      }
    },
    [resetAll, resetOutput, setAsset, setImageEdits, setPreset, setVideoEdits]
  );

  const onProcess = useCallback(async () => {
    if (!asset) return;
    setLocalError(null);
    resetOutput();
    setProcessing({ status: asset.kind === "video" ? "loading-engine" : "processing", progress: 0, detail: undefined, error: undefined });

    try {
      if (asset.kind === "image") {
        const result = await processImage({ asset, edits: imageEdits, preset });
        const url = URL.createObjectURL(result.blob);
        const filename = buildOutputName(asset.name, result.ext);
        setOutput({ blob: result.blob, url, filename, stats: result.stats });
        setProcessing({ status: "done", progress: 1, detail: `Exported ${result.ext.toUpperCase()}` });
      } else {
        setProcessing({ status: "processing", progress: 0, detail: "Loading FFmpeg..." });
        const result = await processVideo({
          asset,
          edits: videoEdits,
          preset,
          onProgress: (p) => setProcessing({ status: "processing", progress: p, detail: "Transcoding..." }),
        });
        const url = URL.createObjectURL(result.blob);
        const filename = buildOutputName(asset.name, result.ext);
        setOutput({ blob: result.blob, url, filename, stats: result.stats });
        setProcessing({ status: "done", progress: 1, detail: "Exported MP4" });
      }
    } catch (e) {
      const message = formatError(e);
      setProcessing({
        status: "error",
        error: message,
        detail: undefined,
        progress: 0,
      });
      setLocalError(message);
    }
  }, [asset, imageEdits, preset, resetOutput, setOutput, setProcessing, videoEdits]);

  const canProcess = !!asset && !isBusy;

  return (
    <div className="min-h-full flex-1 bg-[radial-gradient(1000px_600px_at_20%_10%,#ffe3b1,transparent),radial-gradient(900px_700px_at_90%_20%,#b7e7ff,transparent),radial-gradient(1000px_600px_at_60%_90%,#d8c7ff,transparent)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
                Smart Media Platform
              </h1>
              <p className="mt-1 text-sm text-zinc-700">
                Local-first crop, trim, and compression. Nothing is uploaded.
              </p>
            </div>
            <button
              onClick={resetAll}
              className="h-10 rounded-full bg-white/70 px-4 text-sm font-medium text-zinc-900 ring-1 ring-black/10 backdrop-blur hover:bg-white"
              disabled={isBusy}
            >
              Reset
            </button>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-black/10 backdrop-blur">
            <h2 className="text-sm font-semibold text-zinc-900">Upload</h2>
            <div className="mt-3">
              <DropArea disabled={isBusy} onFile={onDropFile} />
            </div>
            {localError ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-900/10">
                {localError}
              </pre>
            ) : null}

            <div className="mt-6">
              <h2 className="text-sm font-semibold text-zinc-900">Preset</h2>
              <p className="mt-1 text-xs text-zinc-600">Selected: {presetLabel}</p>
              <div className="mt-3">
                <PresetPicker preset={preset} onChange={onPickPreset} disabled={!asset || isBusy} />
              </div>
            </div>

            {asset?.kind === "video" ? (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-zinc-900">Trim</h2>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-700">
                    Start (sec)
                    <input
                      className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10"
                      type="number"
                      step="0.1"
                      min={0}
                      disabled={isBusy}
                      value={videoEdits.trim?.startSec ?? 0}
                      onChange={(e) =>
                        setVideoEdits({
                          trim: {
                            startSec: Number(e.target.value || 0),
                            endSec: videoEdits.trim?.endSec ?? 0,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-700">
                    End (sec)
                    <input
                      className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10"
                      type="number"
                      step="0.1"
                      min={0}
                      disabled={isBusy}
                      value={videoEdits.trim?.endSec ?? 0}
                      onChange={(e) =>
                        setVideoEdits({
                          trim: {
                            startSec: videoEdits.trim?.startSec ?? 0,
                            endSec: Number(e.target.value || 0),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                  Duration: {asset.durationSec ? `${asset.durationSec.toFixed(2)}s` : "unknown"}
                </p>
              </div>
            ) : null}

            {asset?.kind === "image" ? (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-zinc-900">Image Output</h2>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-700">
                    Quality (JPEG)
                    <input
                      className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10"
                      type="number"
                      step="0.01"
                      min={0.1}
                      max={0.95}
                      disabled={isBusy || imageEdits.outputFormat !== "jpeg"}
                      value={imageEdits.quality ?? imagePresets[preset].quality}
                      onChange={(e) => setImageEdits({ quality: Number(e.target.value || 0.72) })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-700">
                    Format
                    <select
                      className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10"
                      disabled={isBusy}
                      value={imageEdits.outputFormat}
                      onChange={(e) => setImageEdits({ outputFormat: e.target.value as "jpeg" | "png" })}
                    >
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                    </select>
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-zinc-700">
                    Resize width (px)
                    <input
                      className="h-10 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10"
                      type="number"
                      min={0}
                      disabled={isBusy}
                      value={imageEdits.resize?.width ?? 0}
                      onChange={(e) =>
                        setImageEdits({
                          resize: {
                            width: Number(e.target.value || 0),
                            height: imageEdits.resize?.height ?? 0,
                            keepAspectRatio: true,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-700">
                    Rotate
                    <div className="flex gap-2">
                      <button
                        className="h-10 flex-1 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10 hover:bg-zinc-50"
                        onClick={() =>
                          setImageEdits({
                            rotationDeg:
                              (((imageEdits.rotationDeg ?? 0) + 90) % 360) as 0 | 90 | 180 | 270,
                          })
                        }
                        disabled={isBusy}
                        type="button"
                      >
                        +90°
                      </button>
                      <button
                        className="h-10 flex-1 rounded-xl bg-white px-3 text-sm ring-1 ring-black/10 hover:bg-zinc-50"
                        onClick={() => setImageEdits({ rotationDeg: 0 })}
                        disabled={isBusy}
                        type="button"
                      >
                        Reset
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3">
              <button
                className="h-12 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
                onClick={onProcess}
                disabled={!canProcess}
              >
                Process ({preset})
              </button>
              <ProcessingBar state={processing} />
            </div>

            {output.stats ? (
              <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-black/10">
                <h2 className="text-sm font-semibold text-zinc-900">Export</h2>
                <div className="mt-2 text-xs text-zinc-700">
                  <div className="flex items-center justify-between">
                    <span>Original</span>
                    <span className="font-medium">{formatBytes(output.stats.originalBytes)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Output</span>
                    <span className="font-medium">{formatBytes(output.stats.outputBytes)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Saved</span>
                    <span className="font-medium">
                      {formatBytes(output.stats.bytesSaved)} ({output.stats.reductionPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Time</span>
                    <span className="font-medium">{output.stats.elapsedMs} ms</span>
                  </div>
                </div>
                {output.url && output.filename ? (
                  <a
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
                    href={output.url}
                    download={output.filename}
                  >
                    Download
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl bg-white/70 p-5 ring-1 ring-black/10 backdrop-blur">
            <h2 className="text-sm font-semibold text-zinc-900">Workspace</h2>
            <p className="mt-1 text-xs text-zinc-600">
              Upload a file to preview and edit. Processing happens in your browser.
            </p>

            <div className="mt-4">
              <MediaPreview asset={asset} />
            </div>

            {asset?.kind === "image" ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-zinc-900">Crop</h3>
                <p className="mt-1 text-xs text-zinc-600">
                  Drag the rectangle to choose what to keep. Crop affects export only.
                </p>
                <div className="mt-3">
                  <ImageCropperFabric asset={asset} disabled={isBusy} />
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="mt-8 text-xs text-zinc-700">
          Built with Next.js, Fabric, and FFmpeg WASM. Tip: large videos can hit browser memory limits.
        </footer>
      </div>
    </div>
  );
}
