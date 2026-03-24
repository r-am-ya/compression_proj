"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaAsset } from "@/types/media";
import { useSmpStore } from "@/stores/smpStore";

type FabricMod = typeof import("fabric");

export default function ImageCropperFabric(props: {
  asset: MediaAsset;
  disabled?: boolean;
}) {
  const { asset, disabled } = props;
  const crop = useSmpStore((s) => s.imageEdits.crop);
  const setCrop = useSmpStore((s) => s.setCrop);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const fabricCanvasRef = useRef<import("fabric").Canvas | null>(null);
  const cropRectRef = useRef<import("fabric").Rect | null>(null);
  const scaleRef = useRef<number>(1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");

  const hasDims = useMemo(() => (asset.width ?? 0) > 0 && (asset.height ?? 0) > 0, [asset]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setStatus("loading");
      const el = canvasElRef.current;
      const host = containerRef.current;
      if (!el || !host) return;

      // Lazy import to avoid any accidental server-side evaluation.
      const fabric = (await import("fabric")) as FabricMod;
      const { Canvas, Rect, FabricImage } = fabric;

      const originalWidth = asset.width ?? 1;
      const originalHeight = asset.height ?? 1;

      const hostWidth = host.clientWidth || 600;
      const maxCanvasWidth = Math.min(900, hostWidth);
      const displayScale = Math.min(1, maxCanvasWidth / originalWidth);
      const canvasWidth = Math.max(1, Math.round(originalWidth * displayScale));
      const canvasHeight = Math.max(1, Math.round(originalHeight * displayScale));
      scaleRef.current = displayScale;

      // Tear down previous canvas if any.
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        cropRectRef.current = null;
      }

      el.width = canvasWidth;
      el.height = canvasHeight;

      const canvas = new Canvas(el, {
        selection: false,
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;

      const img = await FabricImage.fromURL(asset.objectUrl);
      img.set({
        selectable: false,
        evented: false,
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
      });
      img.scale(displayScale);
      canvas.add(img);

      const initLeft = canvasWidth * 0.1;
      const initTop = canvasHeight * 0.1;
      const initW = canvasWidth * 0.8;
      const initH = canvasHeight * 0.8;

      const rect = new Rect({
        left: initLeft,
        top: initTop,
        width: initW,
        height: initH,
        originX: "left",
        originY: "top",
        fill: "rgba(255,255,255,0.06)",
        stroke: "rgba(24,24,27,0.9)",
        strokeDashArray: [8, 6],
        cornerColor: "rgba(24,24,27,0.9)",
        transparentCorners: false,
        lockRotation: true,
        hasRotatingPoint: false,
      });

      rect.setControlsVisibility({ mtr: false });
      rect.set({ selectable: !disabled, evented: !disabled });
      cropRectRef.current = rect;
      canvas.add(rect);
      canvas.setActiveObject(rect);

      const clampRect = () => {
        const r = cropRectRef.current;
        const c = fabricCanvasRef.current;
        if (!r || !c) return;
        const left = Math.max(0, Math.min(r.left ?? 0, c.getWidth() - r.getScaledWidth()));
        const top = Math.max(0, Math.min(r.top ?? 0, c.getHeight() - r.getScaledHeight()));
        if (left !== r.left || top !== r.top) {
          r.set({ left, top });
        }
        r.setCoords();
      };

      const pushCrop = () => {
        const r = cropRectRef.current;
        const c = fabricCanvasRef.current;
        if (!r || !c) return;
        const s = scaleRef.current || 1;
        const left = Math.max(0, r.left ?? 0);
        const top = Math.max(0, r.top ?? 0);
        const w = Math.max(1, r.getScaledWidth());
        const h = Math.max(1, r.getScaledHeight());
        setCrop({
          x: left / s,
          y: top / s,
          width: w / s,
          height: h / s,
        });
      };

      rect.on("moving", () => {
        clampRect();
        pushCrop();
        canvas.requestRenderAll();
      });
      rect.on("scaling", () => {
        clampRect();
        pushCrop();
        canvas.requestRenderAll();
      });
      rect.on("modified", () => {
        clampRect();
        pushCrop();
        canvas.requestRenderAll();
      });

      pushCrop();
      canvas.requestRenderAll();

      if (!cancelled) setStatus("ready");
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [asset.id, asset.objectUrl, asset.height, asset.width, disabled, setCrop]);

  useEffect(() => {
    const rect = cropRectRef.current;
    if (rect) {
      rect.set({ selectable: !disabled, evented: !disabled });
    }
  }, [disabled]);

  const resetCrop = () => {
    const canvas = fabricCanvasRef.current;
    const rect = cropRectRef.current;
    if (!canvas || !rect) return;
    rect.set({
      left: canvas.getWidth() * 0.1,
      top: canvas.getHeight() * 0.1,
      width: canvas.getWidth() * 0.8,
      height: canvas.getHeight() * 0.8,
      scaleX: 1,
      scaleY: 1,
    });
    rect.setCoords();
    canvas.requestRenderAll();
    const s = scaleRef.current || 1;
    setCrop({
      x: (rect.left ?? 0) / s,
      y: (rect.top ?? 0) / s,
      width: rect.getScaledWidth() / s,
      height: rect.getScaledHeight() / s,
    });
  };

  if (!hasDims) {
    return (
      <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
        <p className="text-xs text-zinc-700">Image dimensions unavailable.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="rounded-2xl bg-white p-3 ring-1 ring-black/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-700">
          {status === "loading" ? "Loading canvas…" : crop ? "Crop active" : "Crop"}
        </p>
        <button
          type="button"
          className="h-8 rounded-full bg-white px-3 text-xs font-semibold text-zinc-900 ring-1 ring-black/10 hover:bg-zinc-50 disabled:opacity-50"
          onClick={resetCrop}
          disabled={disabled || status !== "ready"}
        >
          Reset crop
        </button>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl bg-zinc-950/5 ring-1 ring-black/10">
        <canvas ref={canvasElRef} className="block h-auto w-full" />
      </div>
    </div>
  );
}

