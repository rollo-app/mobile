import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { Alert } from "react-native";
import { friendsKey } from "@/features/friends/use-friends";
import { userKey } from "@/features/profile/use-user";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { blockUser, unblockUser } from "./actions";
import { blockedKey } from "./use-blocked";

/** Blocking (with a confirmation) and unblocking someone; both refresh everything that depends on who you can see. */
export function useBlock(userId: string, name: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all(
      [userKey(userId), friendsKey, blockedKey, myTripsKey, ["userFriends"], ["feed"], ["featured"], ["trip"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  const block = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: refresh,
    onError: () => Burnt.alert({ preset: "error", title: "No se pudo bloquear" }),
  });
  const unblock = useMutation({
    mutationFn: () => unblockUser(userId),
    onSuccess: refresh,
    onError: () => Burnt.alert({ preset: "error", title: "No se pudo desbloquear" }),
  });

  return {
    busy: block.isPending || unblock.isPending,
    confirmBlock() {
      Alert.alert(
        `¿Bloquear a ${name}?`,
        "No vas a ver sus fotos ni sus captions en ningún rollo, deja de ser tu amigo o amiga y no te va a poder sumar a rollos.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Bloquear", style: "destructive", onPress: () => block.mutate() },
        ],
      );
    },
    unblock: () => unblock.mutateAsync().then(
      () => undefined,
      () => undefined,
    ),
  };
}
