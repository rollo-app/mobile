import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { meKey, type User } from "@/features/auth/actions";
import { useMe } from "@/features/auth/use-me";
import { updateProfile } from "./actions";

/**
 * "Perfil público" in Ajustes. The switch moves at once; while saving it shows the new value, and if
 * saving fails it goes back and `error` says why.
 */
export function useProfileVisibility() {
  const queryClient = useQueryClient();
  const { me } = useMe();
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A second flip while the first one is saving is ignored.
  const inFlight = useRef(false);

  const isPublic = pending ?? me?.profileVisibility === "public";

  async function setPublic(next: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPending(next);
    try {
      const user = await updateProfile({ profileVisibility: next ? "public" : "friends" });
      queryClient.setQueryData<User>(meKey, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return { isPublic, saving: pending !== null, error, setPublic };
}
