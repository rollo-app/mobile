import type { FeaturedPhoto } from "@/features/featured/actions";

// People and ~5 km zones for featured-photo tests.
export const CAMI = { id: "u2", name: "Cami", username: "cami", avatarUrl: null };
export const JUANI = { id: "u1", name: "Juani", username: "juani", avatarUrl: null };
export const BARILOCHE = { lat: -41.125, lng: -71.325 };
export const CHALTEN = { lat: -49.325, lng: -72.875 };

/** A featured photo on `owner`'s profile (taken by the owner unless `author` says otherwise). */
export const featuredPhoto = (mediaId: string, over: Partial<FeaturedPhoto> = {}, owner = "u1"): FeaturedPhoto => ({
  mediaId,
  takenAt: Date.UTC(2026, 6, 10, 15),
  width: 4000,
  height: 3000,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  author: null,
  zone: BARILOCHE,
  thumbPath: `/featured/${owner}/${mediaId}/thumb`,
  originalPath: `/featured/${owner}/${mediaId}/original`,
  ...over,
});
