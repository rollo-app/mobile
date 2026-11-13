/**
 * Hands a picked photo to the crop screen and its result back, without putting the photo in route params.
 * In memory only: if the app dies mid-crop there is nothing to resume. Profile photos and event covers share it.
 */

export type Photo = { uri: string; width: number; height: number };

/** How the crop looks and what it returns: the square under a circle (avatar) or under a rounded square (cover), at most `size` px a side. */
export type CropOptions = { shape: "circle" | "square"; size: number };

const AVATAR: CropOptions = { shape: "circle", size: 512 };

type Pending = { photo: Photo; options: CropOptions; resolve: (cropped: Photo | null) => void };

const pending = new Map<string, Pending>();
let nextId = 0;

/** Registers a crop; `result` resolves with the cropped photo, or null if it was cancelled. */
export function openCropRequest(photo: Photo, options: CropOptions = AVATAR): { id: string; result: Promise<Photo | null> } {
  const id = String(++nextId);
  const result = new Promise<Photo | null>((resolve) => pending.set(id, { photo, options, resolve }));
  return { id, result };
}

export function cropRequestPhoto(id: string | undefined): Photo | null {
  return (id && pending.get(id)?.photo) || null;
}

export function cropRequestOptions(id: string | undefined): CropOptions {
  return (id && pending.get(id)?.options) || AVATAR;
}

/** Ends a crop (null = cancelled). Settling twice does nothing. */
export function settleCropRequest(id: string | undefined, cropped: Photo | null): void {
  if (!id) return;
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  request.resolve(cropped);
}
