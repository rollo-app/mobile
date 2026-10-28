import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Alert } from "react-native";
import { featuredByKey } from "@/features/activity/use-featured-by";
import { myCommentsKey } from "@/features/activity/use-my-comments";
import { myLikesKey } from "@/features/activity/use-my-likes";
import type { Feed } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";
import { deleteMedia } from "./actions";

type Vars = { mediaId: string; tripId: string };

/**
 * Deletes your own revealed photo or video for good, after a native confirmation. On success it leaves the roll's feed cache
 * right away (so the gallery and the viewer move on) and what counted it is refetched; on failure a native alert.
 * `confirmDelete` resolves true only when it was deleted.
 */
export function useDeletePhoto() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ mediaId }: Vars) => deleteMedia(mediaId),
    onSuccess: (_data, { mediaId, tripId }) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      client.setQueryData<Feed>(feedKey(tripId), (feed) => feed && { ...feed, items: feed.items.filter((i) => i.id !== mediaId) });
      void client.invalidateQueries({ queryKey: feedKey(tripId) });
      void client.invalidateQueries({ queryKey: tripKey(tripId) });
      void client.invalidateQueries({ queryKey: myTripsKey });
      void client.invalidateQueries({ queryKey: ["featured"] });
      void client.invalidateQueries({ queryKey: myLikesKey });
      void client.invalidateQueries({ queryKey: featuredByKey });
      void client.invalidateQueries({ queryKey: myCommentsKey });
    },
    onError: () =>
      Burnt.alert({ preset: "error", title: "No se pudo eliminar", message: "Probá de nuevo cuando tengas señal." }),
  });
  const { mutateAsync } = mutation;

  const confirmDelete = useCallback(
    (photo: { id: string; type?: "photo" | "video" }, tripId: string) =>
      new Promise<boolean>((resolve) =>
        Alert.alert(photo.type === "video" ? "¿Eliminar este video?" : "¿Eliminar esta foto?", "No se puede deshacer.", [
          { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () =>
              void mutateAsync({ mediaId: photo.id, tripId }).then(
                () => resolve(true),
                () => resolve(false),
              ),
          },
        ]),
      ),
    [mutateAsync],
  );

  return { confirmDelete, busy: mutation.isPending };
}
