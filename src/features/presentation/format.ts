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

/** 2000 → "2.000" (es-AR thousands separator; Hermes' Intl skips it on four digits). */
export const formatCount = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** The outro's gallery action when the stories were a selection: every photo and video of the roll. */
export const galleryLabel = (stats: StoryStats) => `Ver las ${formatCount(stats.photos + stats.videos)} fotos en la galería`;

/** Cast names shown in the outro before "y N más". */
export const CAST_MAX = 24;

/** Up to `max` names joined by " · "; the rest become "· y N más" after the last shown name. */
export function castLine(cast: string[], max = CAST_MAX): string {
  const shown = cast.slice(0, max).join(" · ");
  return cast.length > max ? `${shown} · y ${cast.length - max} más` : shown;
}
