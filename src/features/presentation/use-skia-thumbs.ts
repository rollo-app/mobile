import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";

/**
 * Downloads the thumbs into memory (with the session's Bearer, which Skia's `useImage` can't send)
 * and decodes them as Skia images, keyed by photo id. Missing ones simply stay out of the map.
 */
export function useSkiaThumbs(photos: RevealedPhoto[], token: string): Record<string, SkImage> {
  const [images, setImages] = useState<Record<string, SkImage>>({});
  const ids = photos.map((p) => p.id).join(",");

  useEffect(() => {
    let active = true;
    for (const photo of photos) {
      const { uri, headers } = mediaSource(photo.thumbPath, token);
      fetch(uri, { headers })
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
        .then((buffer) => {
          const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(buffer)));
          if (active && image) setImages((prev) => ({ ...prev, [photo.id]: image }));
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [ids, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return images;
}
