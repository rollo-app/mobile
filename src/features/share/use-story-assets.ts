import { useQuery } from "@tanstack/react-query";
import type { Card } from "./card-layout";
import { composeStill } from "./compose-still";
import { writeShareFile } from "./share-story";
import type { StoryStyle } from "./story-style";

export type StoryFile = { uri: string; width: number; height: number };

/**
 * The Stories files as files in the cache: the card (PNG, the Stories sticker) and the still story (JPEG, "Más opciones"),
 * written in parallel. `key` identifies what is drawn (trip, kind and seed) and each style keeps its own entry, so going back
 * to a style already built shows it again without redrawing. `build: null` waits for the data it needs. The render is local,
 * so it runs with no signal too; entries live only while the screen is open and the files are rewritten each time.
 */
export function useStoryAssets(build: (() => Promise<Card>) | null, key: string, name: "collage" | "invite", style: StoryStyle) {
  const query = useQuery({
    queryKey: ["story-image", key, style],
    queryFn: async () => {
      const card = await build!();
      const [cardUri, stillUri] = await Promise.all([
        writeShareFile(card.png, `rollo-${name}-card.png`),
        composeStill(card, style).then((still) => writeShareFile(still, `rollo-${name}-still.jpg`)),
      ]);
      return { card: { uri: cardUri, width: card.width, height: card.height }, stillUri };
    },
    enabled: build !== null,
    networkMode: "always",
    retry: false,
    // Long enough to keep the other style's entry while this one is shown; never persisted.
    gcTime: 10 * 60 * 1000,
    staleTime: Infinity,
  });
  return {
    card: query.data?.card ?? null,
    stillUri: query.data?.stillUri ?? null,
    error: query.isError,
    retry: () => void query.refetch(),
  };
}
