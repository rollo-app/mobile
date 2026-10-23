import { useEffect, useMemo, useRef, useState } from "react";
import { avatarUri } from "@/features/profile/avatar-style";
import type { MapItem } from "./features";
import { ensurePinAvatarFile } from "./pin-avatar-files";
import { avatarSources } from "./pin-avatars";

/**
 * Circular photos of the authors for the map pins, made one at a time in the background (never blocks the map).
 * `ready` are the keys whose image exists; `images` maps each key to its file uri for the map's style.
 * A failure is silent: that author's pin just keeps the initial.
 */
export function usePinAvatars(items: MapItem[]): { ready: ReadonlySet<string>; images: Record<string, string> } {
  const sources = useMemo(() => avatarSources(items), [items]);
  const signature = sources.map((s) => s.key).join("|");
  const [images, setImages] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    for (const s of sources) {
      if (requested.current.has(s.key)) continue;
      requested.current.add(s.key);
      const uri = avatarUri(s.avatarUrl);
      if (!uri) continue;
      queue.current = queue.current.then(async () => {
        try {
          const file = await ensurePinAvatarFile(uri, s.key);
          if (mounted.current) setImages((prev) => ({ ...prev, [s.key]: file }));
        } catch {
          // Without the image the pin keeps its initial and color.
        }
      });
    }
    // `signature` stands for `sources`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const ready = useMemo(() => new Set(Object.keys(images)), [images]);
  return { ready, images };
}
