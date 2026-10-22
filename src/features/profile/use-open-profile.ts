import { router } from "expo-router";
import { useCallback } from "react";
import { useMe } from "@/features/auth/use-me";

/**
 * Opens someone's profile: yours is the Perfil tab; anyone else's is `/user/<id>`, pushed on the root
 * stack. From a sheet or a full-screen modal pass `leave`: a card pushed after a modal would be presented
 * as another modal, so the current one is closed first and the profile is pushed over the tabs.
 */
export function useOpenProfile() {
  const { me } = useMe();
  const myId = me?.id;
  return useCallback(
    (userId: string, { leave = false }: { leave?: boolean } = {}) => {
      if (leave && router.canGoBack()) router.back();
      if (userId === myId) router.navigate("/me");
      else router.push(`/user/${userId}`);
    },
    [myId],
  );
}
