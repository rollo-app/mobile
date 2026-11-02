import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import { cancelMomentNotifications } from "@/features/moments/cancel";
import { deleteTrip } from "@/features/trips/actions";
import { bestEffort } from "@/features/trips/best-effort";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";
import { clearActiveTripId, getActiveTripId } from "@/storage/active-trip";

/** "Borrar rollo" (creator only): asks first; on success the rollo leaves your list and you land on the roll tab. */
export function useDeleteTrip(tripId: string, tripName: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      await deleteTrip(tripId);
    },
    onSuccess: async () => {
      // The server already did it: a failing cleanup step must not turn that into an error or block the navigation.
      await bestEffort(async () => {
        if ((await getActiveTripId()) === tripId) await clearActiveTripId();
      });
      await bestEffort(() => cancelMomentNotifications(tripId));
      await bestEffort(() => queryClient.invalidateQueries({ queryKey: myTripsKey }));
      await bestEffort(() => queryClient.removeQueries({ queryKey: tripKey(tripId) }));
      router.dismissTo("/roll");
    },
  });

  function confirm() {
    Alert.alert(`¿Borrar "${tripName}" para todos?`, "Se borran todas las fotos de todos y no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => mutation.mutate() },
    ]);
  }

  return { confirm, error: errorMessage(mutation.error, "No se pudo borrar el rollo"), deleting: mutation.isPending };
}
