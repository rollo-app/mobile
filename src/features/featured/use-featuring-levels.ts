import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";
import { setMyFeaturing, setTripPrivate } from "./actions";

/** What changes when a rollo's featuring levels do: the rollo (switches), its feed (`canFeature`) and every profile. */
function useRefresh(tripId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tripKey(tripId) }),
      queryClient.invalidateQueries({ queryKey: feedKey(tripId) }),
      queryClient.invalidateQueries({ queryKey: ["featured"] }),
    ]);
}

/**
 * "Tus fotos en otros perfiles" in a rollo (per member). `value` shows the new value while it saves and goes
 * back by itself if it fails (`error` says why).
 */
export function useMyRolloFeaturing(tripId: string, saved: boolean) {
  const refresh = useRefresh(tripId);
  const mutation = useMutation({ mutationFn: (allow: boolean) => setMyFeaturing(tripId, allow), onSuccess: refresh });
  return {
    value: mutation.isPending ? mutation.variables : saved,
    error: errorMessage(mutation.error, "No se pudo guardar"),
    set: (allow: boolean) => mutation.mutate(allow),
  };
}

/** "Rollo privado" (admin): the same, for the whole rollo. */
export function useRolloPrivate(tripId: string, saved: boolean) {
  const refresh = useRefresh(tripId);
  const mutation = useMutation({ mutationFn: (value: boolean) => setTripPrivate(tripId, value), onSuccess: refresh });
  return {
    value: mutation.isPending ? mutation.variables : saved,
    error: errorMessage(mutation.error, "No se pudo guardar"),
    set: (value: boolean) => mutation.mutate(value),
  };
}
