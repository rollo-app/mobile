import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Burnt from "burnt";
import { router } from "expo-router";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import { cancelMomentNotifications } from "@/features/moments/cancel";
import { bestEffort } from "@/features/trips/best-effort";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";
import { clearActiveTripId, getActiveTripId } from "@/storage/active-trip";
import { leaveTrip } from "./actions";

/**
 * "Salirme del rollo": asks first; on success the roll leaves your list. From the board (`"board"`) you land back on
 * the roll tab; from "Tus rollos" (`"list"`, "Eliminar") you stay in the list. A revealed roll can't be rejoined
 * with the code, so the warning changes with `revealed`.
 */
export function useLeaveTrip(tripId: string, tripName: string, { revealed, copy = "board" }: { revealed: boolean; copy?: "board" | "list" }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      await leaveTrip(tripId);
    },
    onSuccess: async () => {
      // The server already did it: a failing cleanup step must not turn that into an error or block the navigation.
      await bestEffort(async () => {
        if ((await getActiveTripId()) === tripId) await clearActiveTripId();
      });
      await bestEffort(() => cancelMomentNotifications(tripId));
      await bestEffort(() => queryClient.invalidateQueries({ queryKey: myTripsKey }));
      await bestEffort(() => queryClient.removeQueries({ queryKey: tripKey(tripId) }));
      if (copy === "board") router.dismissTo("/roll");
    },
    // The board shows the error inline; the list has no place for it, so it says so natively.
    onError: (error) => {
      if (copy === "list") Burnt.alert({ preset: "error", title: errorMessage(error, "No pudiste salirte del rollo") ?? "No pudiste salirte del rollo" });
    },
  });

  function confirm() {
    const list = copy === "list";
    const title = list ? `¿Eliminar "${tripName}" de tus rollos?` : `¿Salirte de "${tripName}"?`;
    const message = revealed
      ? "Salís del rollo y tus fotos se quedan para el grupo. No vas a poder volver a entrar."
      : list
        ? "Salís del rollo y tus fotos se quedan para el grupo. Podés volver con el código."
        : "Tus fotos se quedan en el rollo y ya no lo vas a ver en tu lista. Podés volver con el código.";
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel" },
      { text: list ? "Eliminar" : "Salirme", style: "destructive", onPress: () => mutation.mutate() },
    ]);
  }

  return { confirm, error: errorMessage(mutation.error, "No te pudiste salir del rollo"), leaving: mutation.isPending };
}
