export const SHEET_FRAMES = 18;

type Frame = { takenAt: number; thumbhash: string | null };

/**
 * Los cuadros de la hoja de contacto: los ThumbHash de lo subido y lo pendiente, de la más
 * nueva a la más vieja, hasta `limit`. `null` es un cuadro sin colores (sin thumbhash, o una
 * foto que todavía no conocemos). `rest` es cuánto queda afuera, para el "+N".
 */
export function buildContactSheet({
  feed,
  pending,
  total,
  limit = SHEET_FRAMES,
}: {
  feed: Frame[];
  pending: Frame[];
  total: number;
  limit?: number;
}): { frames: (string | null)[]; rest: number } {
  const shown = Math.max(Math.min(total, limit), 0);
  const known = [...feed, ...pending].sort((a, b) => b.takenAt - a.takenAt).map((x) => x.thumbhash);
  const frames = Array.from({ length: shown }, (_, i) => known[i] ?? null);
  return { frames, rest: Math.max(total - shown, 0) };
}
