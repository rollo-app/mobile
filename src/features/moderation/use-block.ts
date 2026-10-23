import { useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { useState } from "react";
import { Alert } from "react-native";
import { friendsKey } from "@/features/friends/use-friends";
import { userKey } from "@/features/profile/use-user";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { blockUser, unblockUser } from "./actions";
import { blockedKey } from "./use-blocked";

/** Blocking (with a confirmation) and unblocking someone; both refresh everything that depends on who you can see. */
export function useBlock(userId: string, name: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function change(send: () => Promise<void>, failure: string) {
    setBusy(true);
    try {
      await send();
    } catch {
      Burnt.alert({ preset: "error", title: failure });
      return;
    } finally {
      setBusy(false);
    }
    await Promise.all(
      [userKey(userId), friendsKey, blockedKey, myTripsKey, ["userFriends"], ["feed"], ["featured"], ["trip"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }

  return {
    busy,
    confirmBlock() {
      Alert.alert(
        `¿Bloquear a ${name}?`,
        "No vas a ver sus fotos ni sus captions en ningún rollo, deja de ser tu amigo o amiga y no te va a poder sumar a rollos.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Bloquear", style: "destructive", onPress: () => void change(() => blockUser(userId), "No se pudo bloquear") },
        ],
      );
    },
    unblock: () => change(() => unblockUser(userId), "No se pudo desbloquear"),
  };
}
