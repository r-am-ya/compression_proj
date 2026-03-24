import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const outDir = path.join(projectRoot, "public", "ffmpeg");

const copies = [
  {
    from: path.join(
      projectRoot,
      "node_modules",
      "@ffmpeg",
      "core",
      "dist",
      "umd",
      "ffmpeg-core.js"
    ),
    to: path.join(outDir, "ffmpeg-core.js"),
  },
  {
    from: path.join(
      projectRoot,
      "node_modules",
      "@ffmpeg",
      "core",
      "dist",
      "umd",
      "ffmpeg-core.wasm"
    ),
    to: path.join(outDir, "ffmpeg-core.wasm"),
  },
  // This is the essential worker spawned by `new FFmpeg().load()`. It imports
  // `./const.js` and `./errors.js`, so those must be copied beside it.
  {
    from: path.join(
      projectRoot,
      "node_modules",
      "@ffmpeg",
      "ffmpeg",
      "dist",
      "esm",
      "worker.js"
    ),
    to: path.join(outDir, "ffmpeg-class-worker.js"),
  },
  {
    from: path.join(
      projectRoot,
      "node_modules",
      "@ffmpeg",
      "ffmpeg",
      "dist",
      "esm",
      "const.js"
    ),
    to: path.join(outDir, "const.js"),
  },
  {
    from: path.join(
      projectRoot,
      "node_modules",
      "@ffmpeg",
      "ffmpeg",
      "dist",
      "esm",
      "errors.js"
    ),
    to: path.join(outDir, "errors.js"),
  },
];

await mkdir(outDir, { recursive: true });
await Promise.all(copies.map((c) => copyFile(c.from, c.to)));
