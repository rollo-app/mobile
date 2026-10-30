import type { PhotoRecord } from "./data/load-photos.ts";

export const PROFILE_AVATAR = "IMG_6092";
export const MOMENT_MAIN = "IMG_5926";
export const MOMENT_SECOND = "IMG_5930";
export const CAMERA_VIEW = "IMG_6198";

/** Front camera or no GPS: never shown in the gallery or the reveal. */
export const SELFIES = [
  "IMG_5930",
  "IMG_6092",
  "IMG_6123",
  "IMG_6386",
  "1e873e39-f6d1-4e9a-9c78-0eba1026c09c",
  "403A905D-8F7C-4C6E-B70A-87B51F2A3BE1",
];

/** Every non-selfie photo, in capture order. */
export const GALLERY = [
  "IMG_5527",
  "IMG_5620",
  "IMG_5628",
  "IMG_5901",
  "IMG_5926",
  "IMG_5944",
  "IMG_5993",
  "IMG_6014",
  "IMG_6020",
  "IMG_6052",
  "IMG_6073",
  "IMG_6165",
  "IMG_6198",
  "IMG_6206",
  "IMG_6215",
  "IMG_6257",
  "IMG_6406",
];

/** The twelve photos that develop in the reveal (spread over the trip, no near-duplicates). */
export const REVEAL = [
  "IMG_5527",
  "IMG_5620",
  "IMG_5901",
  "IMG_5944",
  "IMG_5993",
  "IMG_6014",
  "IMG_6052",
  "IMG_6165",
  "IMG_6206",
  "IMG_6215",
  "IMG_6257",
  "IMG_6406",
];

/** Photos that have a real location, chronologically. Never places anything at 0,0. */
export function mapPhotos(all: PhotoRecord[]): PhotoRecord[] {
  return all
    .filter((p) => p.lat !== null && p.lng !== null)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}
