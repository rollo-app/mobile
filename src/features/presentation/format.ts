import type { StoryStats } from "./story";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The outro numbers as "N fotos"-style pairs; videos only show up if there are any. */
export function statCounts(stats: StoryStats): { value: number; label: string }[] {
  const items = [
    { value: stats.photos, label: stats.photos === 1 ? "foto" : "fotos" },
    ...(stats.videos > 0 ? [{ value: stats.videos, label: stats.videos === 1 ? "video" : "videos" }] : []),
    { value: stats.people, label: stats.people === 1 ? "persona" : "personas" },
    { value: stats.days, label: stats.days === 1 ? "día" : "días" },
  ];
  return items;
}

export function topLine(stats: StoryStats): string | null {
  return stats.top ? `${stats.top.name} sacó más fotos: ${plural(stats.top.count, "foto", "fotos")}` : null;
}
