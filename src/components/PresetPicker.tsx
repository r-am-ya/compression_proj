"use client";

import type { CompressionPreset } from "@/config/presets";

export default function PresetPicker(props: {
  preset: CompressionPreset;
  onChange: (preset: CompressionPreset) => void;
  disabled?: boolean;
}) {
  const { preset, onChange, disabled } = props;
  const btn = (p: CompressionPreset, label: string, hint: string) => {
    const active = preset === p;
    return (
      <button
        type="button"
        onClick={() => onChange(p)}
        disabled={disabled}
        className={[
          "flex flex-1 flex-col rounded-2xl px-4 py-3 text-left ring-1 transition",
          active ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-900 ring-black/10 hover:bg-zinc-50",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className={["mt-0.5 text-xs", active ? "text-white/80" : "text-zinc-600"].join(" ")}>
          {hint}
        </span>
      </button>
    );
  };

  return (
    <div className="flex gap-2">
      {btn("low", "Low", "Smallest size")}
      {btn("medium", "Medium", "Balanced")}
      {btn("high", "High", "Best quality")}
    </div>
  );
}

