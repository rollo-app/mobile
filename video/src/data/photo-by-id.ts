import type { PhotoRecord } from "../../scripts/photo-record.ts";

export function photoById(id: string, photos: PhotoRecord[]): PhotoRecord {
  const found = photos.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown photo: ${id}`);
  return found;
}
