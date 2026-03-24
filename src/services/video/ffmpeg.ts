import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;
let progressListener: ((event: { progress: number; time: number }) => void) | null =
  null;
let currentOnProgress: ((progress01: number) => void) | undefined;

export async function getLoadedFfmpeg(onProgress?: (progress01: number) => void) {
  if (!ffmpeg) ffmpeg = new FFmpeg();
  if (!loadPromise) {
    loadPromise = (async () => {
      const coreURL = await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript");
      const wasmURL = await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm");
      // `@ffmpeg/ffmpeg` resolves `classWorkerURL` relative to its own `import.meta.url`.
      // In some bundlers this becomes `file://...`, so we must pass an absolute http(s) URL.
      const classWorkerURL = new URL(
        "/ffmpeg/ffmpeg-class-worker.js",
        window.location.origin
      ).toString();
      await ffmpeg!.load({
        coreURL,
        wasmURL,
        classWorkerURL,
      });
    })();
  }

  if (onProgress) {
    currentOnProgress = onProgress;
    if (!progressListener) {
      progressListener = ({ progress }) => currentOnProgress?.(progress);
      ffmpeg.on("progress", progressListener);
    }
  }

  await loadPromise;
  return ffmpeg;
}
