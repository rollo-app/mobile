import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import type { TripDetail } from "@/features/trips/actions";
import type { MemberAction } from "@/features/trips/roles";
import { useMakeAdmin } from "./use-make-admin";
import { useRemoveAdmin } from "./use-remove-admin";
import { useRemoveMember } from "./use-remove-member";

type Member = TripDetail["me"];

/**
 * Role changes and removal for the members list (shared by "En el rollo" and the full list). Only the latest
 * action's error shows: starting one clears the others, and the `others` mutations (e.g. renaming).
 */
export function useMemberActions(tripId: string, others: { reset: () => void }[] = []) {
  const makeAdmin = useMakeAdmin(tripId);
  const removeAdmin = useRemoveAdmin(tripId);
  const removeMember = useRemoveMember(tripId);
  const mine = [makeAdmin, removeAdmin, removeMember];

  const start = (keep?: { reset: () => void }) => {
    for (const m of [...mine, ...others]) if (m !== keep) m.reset();
  };
  const confirmRemove = (m: Member) =>
    Alert.alert(`¿Sacar a ${m.name} del rollo?`, "Sus fotos se quedan. Solo un admin lo puede volver a sumar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sacar",
        style: "destructive",
        onPress: () => {
          start(removeMember);
          removeMember.mutate(m.id);
        },
      },
    ]);
  const run = (action: MemberAction, m: Member) => {
    if (action === "makeAdmin") {
      start(makeAdmin);
      makeAdmin.mutate(m.id);
    } else if (action === "removeAdmin") {
      start(removeAdmin);
      removeAdmin.mutate(m.id);
    } else confirmRemove(m);
  };
  const failure =
    errorMessage(makeAdmin.error, "No se pudo hacer admin") ??
    errorMessage(removeAdmin.error, "No se pudo quitar como admin") ??
    errorMessage(removeMember.error, "No se pudo sacar del rollo");
  return { run, start, failure };
}
