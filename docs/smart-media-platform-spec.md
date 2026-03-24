# Smart Media Platform (SMP)

## 1. Purpose

Smart Media Platform is a browser-first media processing application for:

- uploading image and video files
- previewing media before processing
- applying a small set of high-value edits
- compressing output with predictable presets
- exporting the processed file with size-reduction stats

The MVP is intentionally client-side first. The goal is to prove that modern browsers can handle useful compression and light editing without requiring users to upload media to a server.

## 2. Product Goals

### Primary goals

- reduce media file size with a simple preset-driven UX
- support common image and video flows in one interface
- keep processing local to the browser for privacy and low backend cost
- provide visible progress and post-export size savings

### Non-goals for MVP

- collaborative editing
- timeline-based multitrack video editing
- persistent user accounts
- cloud sync and media library management
- AI-based content-aware compression
- professional-grade codec tuning beyond a few presets

## 3. Users and Core Use Cases

### Target users

- students and professionals reducing upload sizes
- creators preparing media for web or messaging apps
- internal teams standardizing lightweight media assets

### MVP use cases

1. A user drops an image, crops or resizes it, applies a compression preset, and downloads the result.
2. A user uploads a video, trims a clip, applies a preset, and downloads a smaller MP4.
3. A user compares original vs processed size and understands the savings immediately.

## 4. Technical Principles

### Local-first processing

- perform all media processing in-browser when feasible
- avoid backend dependencies in MVP except optional hosting of static assets

### Progressive capability

- images should work even if video tooling fails to load
- video tooling should lazy-load because FFmpeg WASM is large

### Deterministic presets

- users should choose from a small set of presets instead of tuning dozens of encoding knobs
- presets should map to explicit width, quality, bitrate, and codec rules

### Safe failure

- unsupported files must fail early with clear messaging
- long-running operations must expose progress and cancellation when possible

## 5. Recommended Stack

### Frontend

- `Next.js` with App Router
- `React`
- `TypeScript`
- `Tailwind CSS`
- `zustand` for lightweight client state
- `react-dropzone` for upload UX
- `fabric.js` for image editing canvas
- `@ffmpeg/ffmpeg` for video processing
- `comlink` for worker communication

### Optional backend for post-MVP

- `Node.js`
- `Express`
- `multer`
- `fluent-ffmpeg`
- object storage such as `S3`

### Why this stack

- Next.js is sufficient for an app shell, routing, and future API expansion.
- Zustand avoids Redux-level ceremony for a single-user local app.
- Fabric solves crop and transform interactions faster than building them from scratch.
- FFmpeg WASM gives a consistent processing model across browsers, with the tradeoff of load time and memory pressure.

## 6. MVP Feature Scope

### Included

- drag-and-drop upload
- file type and size validation
- image preview
- video preview
- image crop
- image resize
- image rotate
- video trim
- three compression presets
- export and download
- size reduction stats
- in-progress and error UI

### Excluded

- filters and color grading
- subtitle handling
- batch processing
- background upload
- cloud storage
- user history

## 7. Supported Formats

### MVP input

- images: `jpg`, `jpeg`, `png`, `webp`
- video: `mp4`, `mov`, `webm` where browser decoding and FFmpeg WASM support are acceptable

### MVP output

- images: `jpeg` and `png`
- video: `mp4` using H.264 + AAC when available in the chosen FFmpeg build

### Known constraints

- codec support varies by browser and FFmpeg WASM bundle
- very large videos may exceed browser memory limits
- mobile Safari behavior may require reduced feature guarantees

## 8. Functional Requirements

### 8.1 Upload Module

### Responsibilities

- accept drag-and-drop and file picker input
- validate MIME type and extension
- validate size against configurable thresholds
- generate preview metadata

### Validation rules

- reject unsupported file types
- reject files over a configurable maximum
- display actionable error text

### Output contract

```ts
type MediaAsset = {
  id: string;
  file: File;
  kind: "image" | "video";
  name: string;
  sizeBytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
  objectUrl: string;
};
```

### 8.2 Preview Module

### Responsibilities

- render image previews
- render video previews with native controls
- show original metadata

### Requirements

- preview should appear within one interaction after file validation
- original file must remain unchanged until export

### 8.3 Image Editing Module

### Editing operations

- crop
- resize
- rotate in 90 degree increments for MVP

### Internal model

```ts
type ImageEdits = {
  crop?: { x: number; y: number; width: number; height: number };
  resize?: { width: number; height: number; keepAspectRatio: boolean };
  rotationDeg?: 0 | 90 | 180 | 270;
  outputFormat: "jpeg" | "png";
  quality?: number;
};
```

### Processing approach

- load image into canvas or Fabric workspace
- apply crop rectangle
- scale to requested dimensions
- rotate if needed
- export to blob with requested quality

### 8.4 Video Editing Module

### Editing operations

- trim by `startSec` and `endSec`

### Internal model

```ts
type VideoEdits = {
  trim?: { startSec: number; endSec: number };
  resize?: { width: number };
  bitrateKbps?: number;
  outputFormat: "mp4";
};
```

### Processing approach

- write source file into FFmpeg virtual FS
- execute trim and transcode command in a worker
- read output bytes from FFmpeg FS
- convert bytes to downloadable blob

### 8.5 Compression Module

### Presets

```ts
type CompressionPreset = "low" | "medium" | "high";

const imagePresets = {
  low: { maxWidth: 1280, quality: 0.55, format: "jpeg" },
  medium: { maxWidth: 1920, quality: 0.72, format: "jpeg" },
  high: { maxWidth: 2560, quality: 0.85, format: "jpeg" },
} as const;

const videoPresets = {
  low: { width: 640, bitrateKbps: 700 },
  medium: { width: 1280, bitrateKbps: 1500 },
  high: { width: 1920, bitrateKbps: 3000 },
} as const;
```

### Rules

- presets should be adjustable through config, not hardcoded in UI components
- preserve aspect ratio during resizing
- never upscale media in MVP

### 8.6 Export Module

### Responsibilities

- generate output blob
- create downloadable filename
- show original size, processed size, and percentage reduction

### Output stats contract

```ts
type ExportStats = {
  originalBytes: number;
  outputBytes: number;
  bytesSaved: number;
  reductionPct: number;
  elapsedMs: number;
};
```

## 9. Smart Compression Decision Engine

The product should support both explicit presets and an automatic recommendation engine.

### Input signals

- media type
- original size
- dimensions
- duration
- requested goal such as "smallest", "balanced", or "best quality"

### MVP recommendation logic

```ts
function recommendPreset(asset: MediaAsset): CompressionPreset {
  if (asset.kind === "image") {
    if (asset.sizeBytes > 5 * 1024 * 1024) return "low";
    if (asset.sizeBytes > 2 * 1024 * 1024) return "medium";
    return "high";
  }

  if ((asset.durationSec ?? 0) > 120) return "low";
  if ((asset.width ?? 0) > 1920) return "medium";
  return "high";
}
```

### Important constraint

This is a heuristic layer, not a quality oracle. Presets must remain user-overridable.

## 10. Algorithms

### 10.1 Image Compression

### Baseline algorithm

1. decode image into browser image element or `ImageBitmap`
2. compute target dimensions without upscaling
3. draw to canvas
4. export to `Blob` using chosen output format and quality

### Formula

```text
targetWidth = min(originalWidth, preset.maxWidth)
targetHeight = round(originalHeight * targetWidth / originalWidth)
```

### Example

```ts
canvas.toBlob(callback, "image/jpeg", quality);
```

### 10.2 Image Crop

### Baseline algorithm

```ts
ctx.drawImage(
  img,
  crop.x,
  crop.y,
  crop.width,
  crop.height,
  0,
  0,
  outputWidth,
  outputHeight
);
```

### 10.3 Video Compression

### Baseline pipeline

1. write file to FFmpeg FS
2. optionally seek and trim
3. scale with aspect ratio preserved
4. apply target bitrate
5. encode output MP4

### Example command shape

```bash
ffmpeg -i input.mp4 -vf scale=1280:-2 -b:v 1500k -c:v libx264 output.mp4
```

### Notes

- `-2` is often preferable to `-1` for codec-friendly even dimensions
- exact flags depend on the FFmpeg WASM bundle

### 10.4 Video Trim

### Fast path

```bash
ffmpeg -ss 00:00:05 -to 00:00:20 -i input.mp4 -c copy output.mp4
```

### Safe path for MVP

Prefer re-encode during trim when compatibility is more important than speed, because stream copy can fail around non-keyframe boundaries.

## 11. Architecture

### 11.1 MVP Architecture

```text
User -> React UI -> State Store -> Media Service -> Canvas or FFmpeg Worker -> Export Blob
```

### 11.2 Frontend Module Boundaries

```text
src/
  app/
  components/
  features/
    upload/
    preview/
    image-editor/
    video-editor/
    export/
  services/
    ffmpeg/
    image/
  stores/
  workers/
  utils/
  types/
```

### 11.3 Service Responsibilities

### `services/image`

- decode image
- transform via canvas
- export blob

### `services/ffmpeg`

- lazy-load FFmpeg
- manage virtual filesystem
- expose compression and trim commands
- send progress events

### `workers/ffmpeg.worker`

- own the FFmpeg runtime
- keep heavy processing off the main thread

## 12. State Model

Recommended Zustand slices:

- `assetSlice`: active file, metadata, preview URL
- `editSlice`: image edits or video edits
- `processingSlice`: status, progress, error, timings
- `exportSlice`: output blob, stats, filename

### Processing state

```ts
type ProcessingStatus = "idle" | "loading-engine" | "processing" | "done" | "error";
```

## 13. UX Requirements

### Required feedback

- file validation errors must be immediate
- FFmpeg loading must have a dedicated state
- processing must show percent progress when available
- export must display actual numbers, not just "success"

### Suggested user flow

1. Upload file
2. Preview original
3. Choose edit controls based on media type
4. Choose or accept recommended preset
5. Process
6. Compare stats
7. Download

## 14. Performance Strategy

### MVP requirements

- lazy-load FFmpeg only for video flows
- keep FFmpeg in a worker
- revoke object URLs when no longer needed
- avoid storing duplicate large buffers in state

### Limits to enforce

- image max size configurable, for example 25 MB
- video max size configurable, for example 200 MB
- show warning for large files before processing

## 15. Security and Privacy

### MVP posture

- no server upload by default
- no persistent storage required
- validate file type and size before processing
- sanitize filenames used for export

### Risks

- spoofed MIME types
- resource exhaustion from malformed or huge media
- memory crashes on low-end devices

## 16. Error Handling

### Common failure classes

- unsupported format
- FFmpeg load failure
- browser out-of-memory behavior
- export blob generation failure

### Error handling rules

- show plain-language error messages
- preserve the original asset if processing fails
- allow retry after parameter adjustment

## 17. Testing Strategy

### Unit tests

- preset recommendation logic
- size reduction calculations
- image dimension calculation helpers
- filename generation

### Integration tests

- upload and validation flow
- image edit to export flow
- video trim request flow with mocked worker

### Manual acceptance tests

1. Upload a valid PNG and export compressed JPEG.
2. Upload a large MP4, trim 5 seconds, and export smaller MP4.
3. Reject an unsupported file extension.
4. Abort a failed video process without breaking the page state.

## 18. Observability for Post-MVP

If backend or analytics are added later, track:

- file type distribution
- median processing time
- failure rate by browser
- average percentage size reduction

MVP does not need user tracking beyond local debug logging.

## 19. Delivery Plan

### Phase 1: Foundation

- initialize Next.js app with TypeScript and Tailwind
- set up folders, types, and Zustand store
- implement upload, validation, and preview

### Phase 2: Image Pipeline

- add Fabric-based crop and resize UI
- implement canvas export
- add preset-driven image compression

### Phase 3: Video Pipeline

- add FFmpeg lazy loader
- move FFmpeg execution into worker with Comlink
- implement trim and preset-based transcode

### Phase 4: Export and Polish

- add stats comparison UI
- tighten error states and loading feedback
- run browser compatibility checks

## 20. MVP Acceptance Criteria

- user can upload one supported image or video file
- user can preview the asset before processing
- image flow supports crop and resize
- video flow supports trim
- user can choose low, medium, or high compression
- processed file downloads successfully
- UI shows original size, output size, and reduction percentage
- unsupported files fail with clear error messaging

## 21. Post-MVP Extensions

- server-side processing fallback for large files
- batch jobs and queue-based workers
- cloud storage integration
- device-aware preset tuning
- perceptual quality scoring
- AI-assisted region-aware compression

## 22. Codex-Ready Build Tasks

### Foundation

- Create a Next.js app with Tailwind, TypeScript, and Zustand.
- Build a drag-and-drop uploader with image and video preview support.
- Add a typed media asset model and validation utilities.

### Image flow

- Build an image editor using Fabric with crop, resize, and rotate.
- Implement canvas-based export to JPEG or PNG with quality control.
- Add preset recommendation and size comparison stats.

### Video flow

- Initialize FFmpeg WASM lazily and isolate it in a worker using Comlink.
- Implement MP4 trim and preset-based transcode.
- Surface progress and error states during processing.

### Final polish

- Add export naming rules and downloadable blobs.
- Add tests for preset logic and processing helpers.
- Add mobile and low-memory guardrails.
