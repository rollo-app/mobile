import type { RevealedPhoto } from "@/features/media/revealed";

export type Bar =
  | { kind: "progress"; done: number; total: number }
  | {
      kind: "result";
      saved: number;
      failed: RevealedPhoto[];
      cancelled: boolean;
      album: boolean;
      recents: boolean;
    }
  | { kind: "denied" };

export function resultText(bar: Extract<Bar, { kind: "result" }>) {
  const noun = (n: number) => `${n} ${n === 1 ? "foto" : "fotos"}`;
  if (bar.failed.length > 0) return `Se guardaron ${bar.saved}. No se pudieron guardar ${noun(bar.failed.length)}.`;
  if (bar.cancelled) return `Se guardaron ${noun(bar.saved)} antes de cancelar.`;
  if (bar.recents) return `Se guardaron ${noun(bar.saved)} en Recientes`;
  return `Guardadas ${bar.saved} ✓`;
}
