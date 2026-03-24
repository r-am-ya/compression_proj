"use client";

import type { ProcessingStatus } from "@/stores/smpStore";

export default function ProcessingBar(props: {
  state: { status: ProcessingStatus; progress: number; detail?: string; error?: string };
}) {
  const { status, progress, detail, error } = props.state;

  if (status === "idle") return null;

  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  const label =
    status === "loading-engine"
      ? "Loading engine"
      : status === "processing"
        ? "Processing"
        : status === "done"
          ? "Done"
          : "Error";

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-zinc-900">
          {label}
          {detail ? <span className="ml-2 font-medium text-zinc-600">{detail}</span> : null}
        </div>
        <div className="text-xs font-medium text-zinc-700">{status === "error" ? "" : `${pct}%`}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={[
            "h-full rounded-full transition-[width] duration-300",
            status === "error" ? "bg-red-500" : status === "done" ? "bg-emerald-500" : "bg-zinc-900",
          ].join(" ")}
          style={{ width: status === "error" ? "100%" : `${pct}%` }}
        />
      </div>
      {error ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-[11px] leading-4 text-red-800 ring-1 ring-red-900/10">
          {error}
        </pre>
      ) : null}
    </div>
  );
}
