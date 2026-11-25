import { useQuery } from "@tanstack/react-query";
import { writeShareFile } from "./share-story";

/** What a build produces: the card (PNG, the Stories sticker) and the still story (JPEG, "Más opciones"). */
export type StoryBytes = { card: Uint8Array; still: Uint8Array };

/**
 * The Stories files as a file in the cache. `key` identifies what is drawn (trip, kind and seed): it rebuilds when it changes.
 * `build: null` waits for the data it needs. The render is local, so it runs with no signal too and is never saved or kept
 * once the screen closes (the file is rewritten each time).
 */
export function useStoryImage(build: (() => Promise<StoryBytes>) | null, key: string, name: "collage" | "invite") {
  const query = useQuery({
    queryKey: ["story-image", key],
    queryFn: async () => {
      const { card, still } = await build!();
      return { still: await writeShareFile(still, `rollo-${name}-still.jpg`), card: await writeShareFile(card, `rollo-${name}-card.png`) };
    },
    enabled: build !== null,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
  });
  return {
    uri: query.data?.still ?? null,
    cardUri: query.data?.card ?? null,
    error: query.isError,
    retry: () => void query.refetch(),
  };
}
