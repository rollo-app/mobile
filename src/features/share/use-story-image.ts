import { useQuery } from "@tanstack/react-query";
import { writeStoryFile } from "./share-story";

/**
 * The Stories image as a file in the cache. `key` identifies what is drawn (trip, kind and seed): it rebuilds when it changes.
 * `build: null` waits for the data it needs. The render is local, so it runs with no signal too and is never saved or kept
 * once the screen closes (the file is rewritten each time).
 */
export function useStoryImage(build: (() => Promise<Uint8Array>) | null, key: string, name: "collage" | "invite") {
  const query = useQuery({
    queryKey: ["story-image", key],
    queryFn: async () => writeStoryFile(await build!(), name),
    enabled: build !== null,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
  });
  return {
    uri: query.data ?? null,
    error: query.isError,
    retry: () => void query.refetch(),
  };
}
