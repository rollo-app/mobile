import { Image } from "expo-image";
import { useEffect } from "react";
import { mediaSource } from "@/features/media/revealed";
import { upcomingPhotos } from "./upcoming";
import type { StoryStep } from "./story";

/** Only the next two photos are preloaded; on each day card the memory cache is dropped (what's behind is gone). */
export function useStoryPrefetch(steps: StoryStep[], index: number, token: string) {
  useEffect(() => {
    const urls = upcomingPhotos(steps, index, index === 0 ? 3 : 2).flatMap((p) => [
      `${mediaSource(p.thumbPath, token).uri}`,
      ...(p.type === "photo" ? [mediaSource(p.originalPath, token).uri] : []),
    ]);
    const headers = { Authorization: `Bearer ${token}` };
    let active = true;
    const run = async () => {
      if (steps[index]?.kind === "day") await Image.clearMemoryCache().catch(() => false);
      if (active && urls.length) await Image.prefetch(urls, { headers }).catch(() => false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [steps, index, token]);
}
