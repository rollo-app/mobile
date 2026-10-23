/**
 * Hands a picked photo to the crop screen and its result back, without putting the photo in route params.
 * In memory only: if the app dies mid-crop there is nothing to resume.
 */

export type Photo = { uri: string; width: number; height: number };

type Pending = { photo: Photo; resolve: (cropped: Photo | null) => void };

const pending = new Map<string, Pending>();
let nextId = 0;

/** Registers a crop; `result` resolves with the cropped photo, or null if it was cancelled. */
export function openCropRequest(photo: Photo): { id: string; result: Promise<Photo | null> } {
  const id = String(++nextId);
  const result = new Promise<Photo | null>((resolve) => pending.set(id, { photo, resolve }));
  return { id, result };
}

export function cropRequestPhoto(id: string | undefined): Photo | null {
  return (id && pending.get(id)?.photo) || null;
}

/** Ends a crop (null = cancelled). Settling twice does nothing. */
export function settleCropRequest(id: string | undefined, cropped: Photo | null): void {
  if (!id) return;
  const request = pending.get(id);
  if (!request) return;
  pending.delete(id);
  request.resolve(cropped);
}
