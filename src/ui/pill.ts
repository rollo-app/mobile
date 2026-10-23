type Listener = (text: string) => void;

const listeners = new Set<Listener>();

/** Shows a small centered pill with `text` (rendered by `PillHost`). */
export function showPill(text: string) {
  listeners.forEach((fn) => fn(text));
}

export function subscribePill(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
