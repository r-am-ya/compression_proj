export function sanitizeBaseName(name: string): string {
  const trimmed = (name || "file").trim();
  const noExt = trimmed.replace(/\.[^/.]+$/, "");
  const safe = noExt.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
  return safe.replace(/^-+|-+$/g, "") || "file";
}

export function buildOutputName(originalName: string, ext: string) {
  const base = sanitizeBaseName(originalName);
  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  return `${base}.smp.${suffix}.${ext}`;
}

