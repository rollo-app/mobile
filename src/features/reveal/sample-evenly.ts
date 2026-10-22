/** Evenly spread picks, so the reveal samples the whole roll and not just its first day. */
export function sampleEvenly<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)]!);
}
