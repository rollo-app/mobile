import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import { contestKey } from "@/features/contest/use-contest";
import { revealTrip } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";

/** "Revelar ahora" (creator only): asks first; on success the detail, the list and the contest refresh and the reveal flow takes over. */
export function useRevealTrip(tripId: string, tripName: string, contest: boolean) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => revealTrip(tripId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tripKey(tripId) }),
        queryClient.invalidateQueries({ queryKey: myTripsKey }),
        queryClient.invalidateQueries({ queryKey: contestKey(tripId) }),
      ]);
    },
  });

  function confirm() {
    Alert.alert(
      `¿Revelar "${tripName}" ahora?`,
      `Todos van a poder ver las fotos. No se puede deshacer.${contest ? " Se abre la votación del concurso." : ""}`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Revelar", style: "default", onPress: () => mutation.mutate() },
      ],
    );
  }

  return { confirm, error: errorMessage(mutation.error, "No se pudo revelar el rollo"), revealing: mutation.isPending };
}
