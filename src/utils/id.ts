export function randomId(): string {
  // Good enough for single-user local state.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

