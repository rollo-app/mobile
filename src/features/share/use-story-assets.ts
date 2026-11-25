import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Card } from "./card-layout";
import { composeStill } from "./compose-still";
import { fileId } from "./file-id";
import { writeShareFile } from "./share-story";
import type { StoryStyle } from "./story-style";

/** Runs one build step; a failure is rethrown naming the step, with the original error as `cause`. */
export async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    throw new Error(`${name} failed`, { cause });
  }
}

export type StoryFile = { uri: string; width: number; height: number };

/**
 * The Stories files as files in the cache: the card (PNG, the Stories sticker) and the still story (JPEG, "Más opciones"),
 * written in parallel. `key` identifies what is drawn (trip, kind and seed) and each style keeps its own entry, so going back
 * to a style already built shows it again without redrawing. `build: null` waits for the data it needs. The render is local,
 * so it runs with no signal too; entries live only while the screen is open. Files are named per kind, style and seed so a cached entry never points at newer bytes.
 */
export function useStoryAssets(build: (() => Promise<Card>) | null, key: string, name: "collage" | "invite", style: StoryStyle) {
  const query = useQuery({
    queryKey: ["story-image", key, style],
    queryFn: async () => {
      const card = await step("render card", build!);
      // One file per kind, style and seed: the cache keeps older entries, whose uris must keep pointing at their own bytes.
      // The key is hashed: with 8 photo ids it would pass the 255-byte file name limit.
      const id = `${name}-${style}-${fileId(key)}`;
      const [cardUri, stillUri] = await Promise.all([
        step("write files", () => writeShareFile(card.png, `rollo-${id}-card.png`)),
        step("compose still", () => composeStill(card, style)).then((still) => step("write files", () => writeShareFile(still, `rollo-${id}-still.jpg`))),
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
  // The one place a build failure becomes the error state: it is logged once, with the step that failed in the message.
  const { error, errorUpdatedAt } = query;
  useEffect(() => {
    if (error) console.warn("[share] could not build the image", error);
  }, [error, errorUpdatedAt]);
  return {
    card: query.data?.card ?? null,
    stillUri: query.data?.stillUri ?? null,
    error: query.isError,
    retry: () => void query.refetch(),
  };
}
