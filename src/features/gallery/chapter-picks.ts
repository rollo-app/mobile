import type { RevealedPhoto } from "@/features/media/revealed";

export const HERO_MIN_PHOTOS = 4;
export const MAX_QUOTES = 2;

/** The most liked live photo of a chapter, or null if the chapter is too small. */
export function pickHero(photos: RevealedPhoto[]): RevealedPhoto | null {
  if (photos.length < HERO_MIN_PHOTOS) return null;
  let best: RevealedPhoto | null = null;
  for (const p of photos) {
    if (p.type !== "photo" || p.archived) continue;
    if (best === null || p.likeCount > best.likeCount) best = p;
  }
  return best;
}

/** Captioned photos with the most likes (ties to the earlier one), in time order. */
export function pickQuotes(photos: RevealedPhoto[], max: number = MAX_QUOTES): RevealedPhoto[] {
  const ranked = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => !!photo.caption?.trim())
    .sort((a, b) => b.photo.likeCount - a.photo.likeCount || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index);
  return ranked.map(({ photo }) => photo);
}
