const GOLDEN = 0.6180339887498949;

/**
 * Start delay of cell `index`, scattered over [0, staggerMs). Golden-ratio steps never repeat for
 * consecutive indexes, so it works for any number of cells (a fixed step collapses to 0 when it divides n).
 */
export function staggerDelay(index: number, staggerMs: number): number {
  return ((index * GOLDEN) % 1) * staggerMs;
}
