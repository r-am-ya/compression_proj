import type { CompressionPreset } from "@/config/presets";
import { videoPresets } from "@/config/presets";
import type { ExportStats, MediaAsset, VideoEdits } from "@/types/media";
import { computeReduction } from "@/utils/bytes";
import { getLoadedFfmpeg } from "@/services/video/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

type VideoProcessResult = {
  blob: Blob;
  stats: ExportStats;
  ext: "mp4";
};

function clampSec(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function getFileExtLower(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return (m?.[1] || "").toLowerCase();
}

function makeEvenPositive(n: number) {
  const v = Math.floor(n);
  if (v <= 2) return 2;
  return v % 2 === 0 ? v : v - 1;
}

function secToTimestamp(totalSec: number) {
  const s = Math.max(0, totalSec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(
    ss
  ).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export async function processVideo(args: {
  asset: MediaAsset;
  edits: VideoEdits;
  preset: CompressionPreset;
  onProgress?: (progress01: number) => void;
}): Promise<VideoProcessResult> {
  const { asset, edits, preset, onProgress } = args;
  const t0 = performance.now();

  const cfg = videoPresets[preset];
  const ffmpeg = await getLoadedFfmpeg(onProgress);

  const ext = getFileExtLower(asset.name);
  const inputName = `input-${Date.now()}.${ext || "mp4"}`;
  const outputName = `output-${Date.now()}.mp4`;

  const duration = asset.durationSec ?? 0;
  const start = clampSec(edits.trim?.startSec ?? 0, 0, Math.max(0, duration));
  const endDefault = duration > 0 ? duration : start;
  const end = clampSec(
    edits.trim?.endSec ?? endDefault,
    start,
    Math.max(start, duration || start)
  );

  const logs: string[] = [];
  const logCb = (ev: { type: string; message: string }) => {
    const line = `[${ev.type}] ${ev.message}`;
    logs.push(line);
    if (logs.length > 200) logs.splice(0, logs.length - 200);
  };

  const buildBaseArgs = () => {
    const base: string[] = [];
    if (end > start) {
      base.push("-ss", secToTimestamp(start), "-to", secToTimestamp(end));
    }
    base.push("-i", inputName);

    const originalWidth = asset.width ?? 0;
    const desiredWidth =
      originalWidth > 0 ? Math.min(originalWidth, cfg.width) : cfg.width;
    const evenWidth =
      originalWidth > 0 ? makeEvenPositive(desiredWidth) : makeEvenPositive(cfg.width);

    // Always force even output dimensions for broad H.264 compatibility (yuv420p).
    // If the input is already smaller, this results in either no change or a 1px downscale.
    base.push("-vf", `scale=${evenWidth}:-2`);
    return base;
  };

  const attempts: Array<{
    name: string;
    buildArgs: () => string[];
  }> = [
    {
      name: "h264+aac",
      buildArgs: () => [
        ...buildBaseArgs(),
        "-b:v",
        `${cfg.bitrateKbps}k`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outputName,
      ],
    },
    {
      name: "h264+noaudio",
      buildArgs: () => [
        ...buildBaseArgs(),
        "-b:v",
        `${cfg.bitrateKbps}k`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        outputName,
      ],
    },
    {
      name: "mpeg4+noaudio",
      buildArgs: () => [
        ...buildBaseArgs(),
        "-b:v",
        `${cfg.bitrateKbps}k`,
        "-c:v",
        "mpeg4",
        "-q:v",
        "4",
        "-movflags",
        "+faststart",
        "-an",
        outputName,
      ],
    },
  ];

  await ffmpeg.writeFile(inputName, await fetchFile(asset.file));
  ffmpeg.on("log", logCb);

  let lastErr: unknown = null;
  try {
    // Best-effort: dump minimal codec metadata to logs for debugging failures.
    try {
      const probeOut = `probe-${Date.now()}.txt`;
      await ffmpeg.ffprobe([
        "-v",
        "error",
        "-show_entries",
        "format=format_name,duration:stream=index,codec_type,codec_name,width,height",
        "-of",
        "default=noprint_wrappers=1",
        inputName,
        "-o",
        probeOut,
      ]);
      const probe = await ffmpeg.readFile(probeOut, "utf8");
      logs.push("[info] ffprobe:\n" + String(probe).trim());
      await ffmpeg.deleteFile(probeOut);
    } catch {
      logs.push("[info] ffprobe: unavailable");
    }

    for (const attempt of attempts) {
      logs.push(`[info] Attempt: ${attempt.name}`);
      let exitCode = -1;
      try {
        exitCode = await ffmpeg.exec(attempt.buildArgs());
      } catch (e) {
        lastErr = e;
        logs.push(`[error] exec threw during ${attempt.name}`);
      }
      logs.push(`[info] Exit code (${attempt.name}): ${exitCode}`);
      if (exitCode === 0) {
        const out = await ffmpeg.readFile(outputName);
        const outBytes =
          out instanceof Uint8Array
            ? out
            : new TextEncoder().encode(String(out));
        const blobBytes = new Uint8Array(outBytes);
        const blob = new Blob([blobBytes], { type: "video/mp4" });
        await ffmpeg.deleteFile(outputName);
        await ffmpeg.deleteFile(inputName);

        const t1 = performance.now();
        const { bytesSaved, reductionPct } = computeReduction(
          asset.sizeBytes,
          blob.size
        );

        const stats: ExportStats = {
          originalBytes: asset.sizeBytes,
          outputBytes: blob.size,
          bytesSaved,
          reductionPct,
          elapsedMs: Math.round(t1 - t0),
        };

        return { blob, stats, ext: "mp4" };
      }

      // Clean any partial output before next attempt.
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {
        // ignore
      }
    }
  } catch (e) {
    lastErr = e;
  } finally {
    ffmpeg.off("log", logCb);
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore
    }
  }

  const tail = logs.slice(-20).join("\n");
  const errMsg = lastErr instanceof Error ? lastErr.message : "FFmpeg failed";
  throw new Error(`${errMsg}\n\nFFmpeg log tail:\n${tail}`);
}
