import { createContext, useContext, type ReactNode } from "react";
import type { PhotoRecord } from "../../scripts/photo-record.ts";
import { photoById } from "./photo-by-id.ts";

const PhotosContext = createContext<PhotoRecord[] | null>(null);

export const PhotosProvider = ({ photos, children }: { photos: PhotoRecord[]; children: ReactNode }) => (
  <PhotosContext.Provider value={photos}>{children}</PhotosContext.Provider>
);

export function usePhotos(): PhotoRecord[] {
  const photos = useContext(PhotosContext);
  if (!photos) throw new Error("usePhotos fuera de PhotosProvider");
  return photos;
}

export function usePhoto(id: string): PhotoRecord {
  return photoById(id, usePhotos());
}
