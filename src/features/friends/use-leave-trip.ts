import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";
import { clearActiveTripId, getActiveTripId } from "@/storage/active-trip";
import { leaveTrip } from "./actions";

/** "Salirme del rollo": asks first; on success the roll leaves your list and you land back on the board. */
export function useLeaveTrip(tripId: string, tripName: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      await leaveTrip(tripId);
      if ((await getActiveTripId()) === tripId) await clearActiveTripId();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: myTripsKey });
      queryClient.removeQueries({ queryKey: tripKey(tripId) });
      router.dismissTo("/roll");
    },
  });

  function confirm() {
    Alert.alert(`¿Salirte de "${tripName}"?`, "Tus fotos se quedan en el rollo y ya no lo vas a ver en tu lista. Podés volver con el código.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salirme", style: "destructive", onPress: () => mutation.mutate() },
    ]);
  }

  return { confirm, error: errorMessage(mutation.error, "No te pudiste salir del rollo"), leaving: mutation.isPending };
}
