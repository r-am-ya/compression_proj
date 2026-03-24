export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : unitIndex === 1 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function computeReduction(originalBytes: number, outputBytes: number) {
  const bytesSaved = Math.max(0, originalBytes - outputBytes);
  const reductionPct =
    originalBytes > 0 ? Math.max(0, (bytesSaved / originalBytes) * 100) : 0;
  return { bytesSaved, reductionPct };
}

