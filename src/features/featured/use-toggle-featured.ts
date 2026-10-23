import * as Burnt from "burnt";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useMe } from "@/features/auth/use-me";
import type { Feed } from "@/features/trips/actions";
import { feedKey } from "@/features/trips/use-feed";
import { featureMedia, unfeatureMedia } from "./actions";
import { featuredKey } from "./use-featured";

function setFeaturedInFeed(client: QueryClient, tripId: string, mediaId: string, featuredByMe: boolean) {
  client.setQueryData<Feed>(feedKey(tripId), (feed) =>
    feed ? { ...feed, items: feed.items.map((item) => (item.id === mediaId ? { ...item, featuredByMe } : item)) } : feed,
  );
}

/**
 * Features or unfeatures a revealed photo on your profile. Optimistic over the roll's feed cache;
 * on failure it puts the previous value back and exposes the server's message in `error`.
 * A second toggle of the same photo while the first is pending is ignored.
 */
export function useToggleFeatured() {
  const client = useQueryClient();
  const { me } = useMe();
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (photo: { id: string; featuredByMe: boolean }, tripId: string) => {
      if (inFlight.current.has(photo.id)) return;
      inFlight.current.add(photo.id);
      setPending(new Set(inFlight.current));
      setError(null);

      const next = !photo.featuredByMe;
      // A refetch landing mid-request would overwrite the optimistic value.
      await client.cancelQueries({ queryKey: feedKey(tripId) });
      setFeaturedInFeed(client, tripId, photo.id, next);
      try {
        await (next ? featureMedia : unfeatureMedia)(photo.id);
        if (me) void client.invalidateQueries({ queryKey: featuredKey(me.id) });
        if (next) Burnt.alert({ title: "Agregada a tu perfil", preset: "done", duration: 2, haptic: "success" });
      } catch (e) {
        setFeaturedInFeed(client, tripId, photo.id, photo.featuredByMe);
        setError(e instanceof Error ? e.message : "No se pudo cambiar la foto destacada");
      } finally {
        inFlight.current.delete(photo.id);
        setPending(new Set(inFlight.current));
      }
    },
    [client, me],
  );

  return { toggle, pending, error };
}
