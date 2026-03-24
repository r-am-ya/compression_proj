function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatAny(value: unknown): string {
  if (value instanceof Error) return formatError(value);
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatError(err: unknown, depth = 0): string {
  const pad = "  ".repeat(depth);

  if (err instanceof DOMException) {
    return `${pad}${err.name}: ${err.message}`;
  }

  if (err instanceof Error) {
    const lines: string[] = [];
    lines.push(`${pad}${err.name}: ${err.message}`);
    if (err.stack) lines.push(`${pad}${err.stack}`);

    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      lines.push(`${pad}Caused by:`);
      lines.push(formatError(cause, depth + 1));
    }
    return lines.join("\n");
  }

  if (isRecord(err)) {
    const name = typeof err.name === "string" ? err.name : "Error";
    const message =
      typeof err.message === "string" ? err.message : formatAny(err);
    return `${pad}${name}: ${message}`;
  }

  return `${pad}${formatAny(err)}`;
}

